suppressPackageStartupMessages(library(GenomicAlignments))
suppressPackageStartupMessages(library(GenomicFeatures))
suppressPackageStartupMessages(library(data.table))
suppressPackageStartupMessages(library("jsonlite"))
suppressPackageStartupMessages(library(seqinr))
suppressPackageStartupMessages(library("parallel"))
suppressPackageStartupMessages(library("plyr"))
suppressPackageStartupMessages(library(Rsamtools))
suppressPackageStartupMessages(library(ggpubr))

psite_plot <- function(data, flanking = 30, cl = 99) {
    names <- names(data)
    offset <- NULL
    n <- "sample"
    dt <- data
    lev <- sort(unique(dt$qwidth))    
	if(species == "ecoli_k12" | species == "bsu_168" | species == "pfu_dsm_3638" | species == "hsa_NRC1") {
		dt[, site_dist_end5 := end - start_pos]
		dt[, site_dist_end3 := end - stop_pos]
	} else {
		dt[, site_dist_end5 := start - start_pos]
		dt[, site_dist_end3 := start - stop_pos]
	}
	if(seqType == "monosome"){
		site_sub5 <- dt[site_dist_end5 <= 50 & site_dist_end5 >= -25]
	} else {
		site_sub5 <- dt[site_dist_end5 <= 50 & site_dist_end5 >= -60]
	}
	offset_temp <- site_sub5[, list(offset_from_5 = as.numeric(names(which.max(table(site_dist_end5))))), by = qwidth]
    # plot
    options(warn=-1)
    #minlen <- ceiling(quantile(site_sub5$qwidth, (1 - cl/100)/2))
    #maxlen <- ceiling(quantile(site_sub5$qwidth, 1 - (1 - cl/100)/2))
	minlen<- min(site_sub5$qwidth)
	maxlen<- max(site_sub5$qwidth)
	plotlist <- list()
	resultlist <- list()
    for (len in minlen:maxlen) {
        site_temp <- dt[qwidth == len]
		if(seqType == "monosome"){
			site_tab5 <- data.table(table(factor(site_temp$site_dist_end5, levels = -25 : 50)))
		} else {
			site_tab5 <- data.table(table(factor(site_temp$site_dist_end5, levels = -60 : 50)))
		}
        setnames(site_tab5, c("distance", "reads"))		
        site_tab5[, distance := as.numeric(as.character(site_tab5$distance))]
        final_tab <- site_tab5
        final_tab[,length:=len]
		resultlist[[as.character(len)]] <- final_tab 
    }
	#options(warn=0)	
	results <- rbindlist(resultlist)
	fwrite(results, file=paste0(resultdir, "/", "psite.txt"), sep="\t")
	fwrite(results, file=paste0(resultdir, "/", "psite.csv"))

	# for stop codon
	if(seqType == "monosome"){
		site_sub3 <- dt[site_dist_end3 <= 25 & site_dist_end3 >= -50]
	} else {
		site_sub3 <- dt[site_dist_end3 <= 25 & site_dist_end3 >= -60]
	}
	offset_temp <- site_sub3[, list(offset_from_5 = as.numeric(names(which.max(table(site_dist_end3))))), by = qwidth]
    
    #options(warn=-1)
	minlen<- min(site_sub3$qwidth)
	maxlen<- max(site_sub3$qwidth)
	plotlist <- list()
	resultlist <- list()
	for (len in minlen:maxlen) {
        site_temp <- dt[qwidth == len]
		if(seqType == "monosome"){
			site_tab5 <- data.table(table(factor(site_temp$site_dist_end3, levels = -50 : 25)))
		} else {
			site_tab5 <- data.table(table(factor(site_temp$site_dist_end3, levels = -60 : 25)))
		}
        setnames(site_tab5, c("distance", "reads"))		
        site_tab5[, distance := as.numeric(as.character(site_tab5$distance))]
        final_tab <- site_tab5
        final_tab[,length:=len]    
		resultlist[[as.character(len)]] <- final_tab 
    }
    #options(warn=0)
	results <- rbindlist(resultlist)
	fwrite(results, file=paste0(resultdir, "/", "psite_stopcodon.txt"), sep="\t")
	fwrite(results, file=paste0(resultdir, "/", "psite_stopcodon.csv"))
	#return(plotlist)
}	   

#saturation analysis
rpf_saturation <- function(reads) {
	mapped_reads = length(reads$qname)
	steps <- seq(1,10,1)
	nums <- as.integer(steps * 0.1 * mapped_reads)
	site <- 0
	total_gene_num <- length(unique(txlens[cds_len>0]$gene_id))
	saturation <- data.frame()
	for (num in nums) {
		#message(num)
		temp = sample(1:mapped_reads, num, replace = FALSE)
		temp_gene <- reads[temp,gene_id]
		temp_gene <- as.data.table(table(temp_gene))
		gene_num <- length(temp_gene$temp_gene)
		site = site+1
		saturation <- rbind(saturation,c(site, num, gene_num))
	}
	saturation <- as.data.table(saturation)
	setnames(saturation,c("site","num","gene_num"))
	saturation[,perc:=num/mapped_reads]
	saturation[,perc_gene:=gene_num/total_gene_num]
	#ggline(saturation, x = "perc", y = "perc_gene",color = "blue")+scale_x_discrete(breaks=steps*0.1)
	ggplot(saturation, aes(x=perc, y=perc_gene, color="blue"))+geom_line()+geom_point()+scale_x_continuous(breaks=steps*0.1,limits=c(0,1))+ theme(legend.position="none")+labs(x="Percentage of RPF reads", y = "Percentage of covered genes")
	suppressMessages(ggsave(paste0(resultdir,"/saturation.lineplot.pdf")))
	suppressMessages(ggsave(paste0(resultdir,"/saturation.lineplot.png"), bg='white'))
	fwrite(saturation, file=paste0(resultdir, "/", "saturation.gene.txt"), sep="\t")
	fwrite(saturation, file=paste0(resultdir, "/", "saturation.gene.csv"))
}	
	
#' Main function to transform alignment data to ribosome occupancy/coverage data
#' @return Nothing, instead it writes out occupancy data in a .tsv file and in 2 .wig IGV tracks (+ and - strands)
get_coverage <- function(bamfile, txlens) {
	resultdir <- dirname(bamfile)	
	txlens2 <- data.table::copy(txlens)	
	param <- ScanBamParam(flag = scanBamFlag(), simpleCigar = FALSE, reverseComplement = FALSE, what = c("qname"))
	reads <- as.data.table(readGAlignments(bamfile, index=paste(bamfile, '.bai', sep = ''), param=param))
	reads[, match_len := cigarWidthAlongQuerySpace(cigar, after.soft.clipping =T)]	
	reads[,freq := gsub("^.*_x","",qname, perl=T)]
	reads[,freq := as.numeric(freq)]
	
	if(species == "bta.ARS-UCD1.2" | species == "clu.ROS_Cfam_1.0" | species == "gga.GRCg7b" | species == "ggo.gorGor4" | species == "mml.Mmul_10" | species == "ptr.Pan_tro_3.0" | species == "Sars_cov_2" | species == "ssc.Sscrofa11.1" | species == "xtr.UCB_Xtro_10.0") {
		reads[,seqnames := gsub("\\.\\d+$","",seqnames, perl=T)]
	}
	
	txlens2[,c('tx_id','nexon') := NULL]
	setnames(txlens2,c("tx_name"),c("transcriptID"))
	setnames(reads,c("seqnames"),c("transcriptID"))
	reads = merge(reads, txlens2, by='transcriptID')
	reads[,start_pos:=utr5_len+1+tssExtension]
	reads[,stop_pos:=utr5_len+cds_len+tssExtension]
	psite_plot(reads)
	rpf_saturation(reads)
	# Release memory	
	rm(reads)
	invisible(gc(verbose = FALSE))
}

#main
args <- commandArgs(TRUE)
species <- args[1]
jobid <- args[2]
samplename <- args[3]
seqType <- args[4]

#species <- "osa_IRGSP_1"
#jobid <- "aMsYMPC7ryIsZ7Zh"
#samplename <- "aMsYMPC7ryIsZ7Zh"

options(bitmapType='cairo')
samplenames <- strsplit(unlist(strsplit(samplename, "[#]")),"[-]")

resultdir = paste0("./data/results/",jobid)
bamfile=paste0(resultdir, "/mRNA.sort.bam")

if(species == "sce_R64" | species == "ecoli_k12" | species == "bsu_168" | species == "pfu_dsm_3638" | species == "hsa_NRC1"){
	tssExtension = 25;
} else {
	tssExtension = 0;
}
###### GET RIBOSOME OCCUPANCY DATA FROM ALIGNMENT FILES ######
load(paste0("./db/annotation/",species,".txlens.rda"))

# Process all datasets using get_coverage()
get_coverage(bamfile = bamfile, txlens)

