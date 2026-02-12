// src/modules/Setup/SpeciesRegistry.ts

export interface SpeciesEntry {
  id: string;
  name: string;
  assembly: string;
}

export const SPECIES_LIST: SpeciesEntry[] = [
  {
    id: "osa_IRGSP_1",
    name: "Oryza sativa",
    assembly: "IRGSP 1.0, RAP-DB version",
  },
  {
    id: "osa_IRGSP_msu7",
    name: "Oryza sativa",
    assembly: "IRGSP 1.0, MSU7 version",
  },
  { id: "hsa_hg38_v46", name: "Homo sapiens", assembly: "hg38, GENECODE V46" },
  { id: "hsa_hg38_v32", name: "Homo sapiens", assembly: "hg38, GENECODE V32" },
  { id: "mmu_mm39", name: "Mus musculus", assembly: "mm39" },
  { id: "mmu_mm10", name: "Mus musculus", assembly: "mm10" },

  { id: "hsa_hg19", name: "Homo sapiens", assembly: "hg19" },
  { id: "rno_rn6", name: "Rattus norvegicus", assembly: "rn6" },
  { id: "dre_grcz11", name: "Danio rerio", assembly: "GRCz11" },
  { id: "bta_ars_ucd_1_2", name: "Bos taurus", assembly: "ARS-UCD1.2" },
  {
    id: "clf_ros_cfam_1_0",
    name: "Canis lupus familiaris",
    assembly: "ROS Cfam 1.0",
  },
  { id: "gga_grcg7b", name: "Gallus gallus", assembly: "GRCg7b" },
  { id: "ggo_gorgor4", name: "Gorilla gorilla", assembly: "gorGor4" },
  { id: "mma_mmul_10", name: "Macaca mulatta", assembly: "Mmul_10" },
  { id: "ptr_pan_tro_3_0", name: "Pan troglodytes", assembly: "Pan_tro_3.0" },
  { id: "ssc_sscrofa11_1", name: "Sus scrofa", assembly: "Sscrofa11.1" },
  {
    id: "xtr_ucb_xtro_10_0",
    name: "Xenopus tropicalis",
    assembly: "UCB Xtro 10.0",
  },
  { id: "cel_wbcel235", name: "Caenorhabditis elegans", assembly: "WBcel235" },
  { id: "dme_bdgp6", name: "Drosophila melanogaster", assembly: "BDGP6" },
  { id: "aga_agamp4", name: "Anopheles gambiae", assembly: "AgamP4" },
  { id: "lmi_ncbi_v2", name: "Locusta migratoria", assembly: "NCBI V2" },
  { id: "lmi_cau_v1", name: "Locusta migratoria", assembly: "CAU V1" },
  { id: "sce_r64", name: "Saccharomyces cerevisiae", assembly: "R64" },
  { id: "ncr_nc12", name: "Neurospora crassa", assembly: "NC12" },

  { id: "ath_tair10", name: "Arabidopsis thaliana", assembly: "TAIR10" },
  { id: "atr_v1", name: "Acer truncatum", assembly: "v1" },
  {
    id: "acv_asm1452938v2",
    name: "Adiantum capillus-veneris",
    assembly: "ASM1452938v2",
  },
  { id: "aca_v2", name: "Amphidinium carterae", assembly: "v2" },
  { id: "bna_ast_v1", name: "Brassica napus", assembly: "AST_PRJEB5043_v1" },
  { id: "bra_1_0", name: "Brassica rapa", assembly: "Brapa 1.0" },
  { id: "bdi_v3_0", name: "Brachypodium distachyon", assembly: "bdi.v3.0" },
  { id: "csi_ahau_css_1", name: "Camellia sinensis", assembly: "AHAU_CSS_1" },
  { id: "cre_v5_5", name: "Chlamydomonas reinhardtii", assembly: "v5.5" },
  {
    id: "csa_v3",
    name: "Cucumis sativus chineseLong",
    assembly: "chineseLong_v3",
  },
  { id: "csa_asm407v2", name: "Cucumis sativus", assembly: "ASM407v2" },
  { id: "dcu_v1", name: "Dalbergia cultrat", assembly: "V1" },
  { id: "gma_v2_1", name: "Glycine max", assembly: "v2.1" },
  {
    id: "gra_2_0_v6",
    name: "Gossypium raimondii",
    assembly: "Graimondii2_0_v6",
  },
  { id: "lch_v1", name: "Litchi chinensis", assembly: "v1" },
  {
    id: "mdo_asm211411v1",
    name: "Malus domestica golden",
    assembly: "ASM211411v1",
  },
  { id: "mtu_4_0", name: "Medicago truncatula", assembly: "MedtrA17 4.0" },
  { id: "mpo_4_0", name: "Marchantia polymorpha", assembly: "MedtrA17 4.0" },
  { id: "nbe_v1", name: "Nicotiana benthamiana", assembly: "v1" },
  { id: "nta_tn90", name: "Nicotiana tabacum", assembly: "TN90" },

  { id: "osa_huazhan_1_0", name: "Oryza sativa", assembly: "Huazhan 1.0" },
  { id: "osa_basmati1", name: "Oryza sativa", assembly: "Basmati1 IGDBv1" },
  { id: "osa_cg14", name: "Oryza sativa", assembly: "CG14 IGDBv1" },
  { id: "osa_g46", name: "Oryza sativa", assembly: "G46 IGDBv1" },
  { id: "osa_ir64", name: "Oryza sativa", assembly: "IR64 IGDBv1" },
  { id: "osa_lemont", name: "Oryza sativa", assembly: "Lemont IGDBv1" },
  { id: "osa_lj", name: "Oryza sativa", assembly: "LJ IGDBv1" },
  { id: "osa_msu_igdb", name: "Oryza sativa", assembly: "MSU IGDBv1" },
  { id: "osa_namroo", name: "Oryza sativa", assembly: "NamRoo IGDBv1" },
  { id: "osa_n22", name: "Oryza sativa", assembly: "N22" },
  { id: "osa_tm", name: "Oryza sativa", assembly: "TM IGDBv1" },
  { id: "osa_tumba", name: "Oryza sativa", assembly: "Tumba IGDBv1" },
  { id: "osa_wssm", name: "Oryza sativa", assembly: "WSSM IGDBv1" },
  { id: "oin_asm465v1", name: "Oryza indica", assembly: "ASM465v1" },
  { id: "oru_or_w1943", name: "Oryza rufipogon", assembly: "OR_W1943" },

  { id: "ptr_v3", name: "Populus trichocarpa", assembly: "Pop_tri_v3" },
  { id: "ppa_v3", name: "Physcomitrium patens", assembly: "Phypa_V3" },
  { id: "smo_v1_0", name: "Selaginella moellendorffii", assembly: "v1.0" },
  { id: "sly_v3_0", name: "Solanum lycopersicum", assembly: "SL v3.0" },
  { id: "stu_3_0", name: "Solanum tuberosum", assembly: "SolTub 3.0" },
  { id: "sbi_v3", name: "Sorghum bicolor", assembly: "NCBIv3" },
  { id: "ska_v1", name: "Symbiodinium kawagutii", assembly: "Fugka2468_1" },
  { id: "tae_v1_0", name: "Triticum aestivum", assembly: "IWGSC RefSeq 1.0" },
  { id: "vvi_v4", name: "Vitis vinifera", assembly: "PN40024.v4" },
  { id: "zma_v4", name: "Zea mays", assembly: "B73 RefGen v4" },
  { id: "zma_5_0", name: "Zea mays", assembly: "B73 NAM 5.0" },

  { id: "eco_k12", name: "Escherichia coli", assembly: "K-12" },
  { id: "bsu_168", name: "Bacillus subtilis", assembly: "str. 168" },
  { id: "pfu_3638", name: "Pyrococcus furiosus", assembly: "DSM 3638" },
  { id: "hsa_nrc1", name: "Halobacterium salinarum", assembly: "NRC1" },
  { id: "mma_asm706v1", name: "Methanosarcina mazei", assembly: "ASM706v1" },
  {
    id: "awo_asm24760v1",
    name: "Acetobacterium woodii",
    assembly: "DSM 1030 (ASM24760v1)",
  },
  {
    id: "bth_asm1106v1",
    name: "Bacteroides thetaiotaomicron",
    assembly: "VPI-5482 (ASM1106v1)",
  },
  {
    id: "cvi_asm2200v1",
    name: "Caulobacter vibrioides",
    assembly: "NA1000 (ASM2200v1)",
  },
  {
    id: "cac_gca_001042715",
    name: "Clostridium aceticum",
    assembly: "DSM 1496 (GCA_001042715)",
  },
  {
    id: "cdr_gca_001042715",
    name: "Clostridium drakei",
    assembly: "DSM 1496 (GCA_001042715)",
  },
  {
    id: "clj_asm14368v1",
    name: "Clostridium ljungdahlii",
    assembly: "DSM 13528 (ASM14368v1)",
  },
  {
    id: "eco_rv308",
    name: "Escherichia coli",
    assembly: "K-12 substr. RV308 (ASM93156v1)",
  },
  {
    id: "eli_asm148172v1",
    name: "Eubacterium limosum",
    assembly: "SA11 (ASM148172v1)",
  },
  {
    id: "fjo_asm1664v1",
    name: "Flavobacterium johnsoniae",
    assembly: "UW101 (ASM1664v1)",
  },
  {
    id: "hsa_asm680v1",
    name: "Halobacterium salinarum",
    assembly: "NRC-1 (ASM680v1)",
  },
  {
    id: "hvo_asm2568v1",
    name: "Haloferax volcanii",
    assembly: "DS2 (ASM2568v1)",
  },
  {
    id: "kmi_asm96357v1",
    name: "Klebsiella michiganensis",
    assembly: "RC10 (ASM96357v1)",
  },
  {
    id: "lrh_gca_002287945",
    name: "Lacticaseibacillus rhamnosus GG",
    assembly: "DSM 14870 (GCA_002287945)",
  },
  {
    id: "lin_asm19579v1",
    name: "Listeria innocua",
    assembly: "Clip11262 (ASM19579v1)",
  },
  {
    id: "lmo_asm19603v1",
    name: "Listeria monocytogenes",
    assembly: "EGD-e (ASM19603v1)",
  },
  {
    id: "mtu_asm1614v1",
    name: "Mycobacterium tuberculosis",
    assembly: "H37Ra (ASM1614v1)",
  },
  {
    id: "mab_asm6918v1",
    name: "Mycobacteroides abscessus",
    assembly: "ATCC19977 (ASM6918v1)",
  },
  {
    id: "msm_asm1500v1",
    name: "Mycolicibacterium smegmatis",
    assembly: "MC2-155 (ASM1500v1)",
  },
  {
    id: "pae_gca_002968755",
    name: "Pseudomonas aeruginosa",
    assembly: "AR441 (GCA_002968755)",
  },
  {
    id: "pfl_asm130715v1",
    name: "Pseudomonas fluorescens",
    assembly: "FW300-N2E3 (ASM130715v1)",
  },
  {
    id: "sen_gca_003325055",
    name: "Salmonella enterica",
    assembly: "GCA_003325055",
  },
  {
    id: "sme_asm219712v1",
    name: "Sinorhizobium meliloti",
    assembly: "M162 (ASM219712v1)",
  },
  {
    id: "sau_gca_001018655",
    name: "Staphylococcus aureus",
    assembly: "gca_001018655",
  },
  {
    id: "spn_asm1896v1",
    name: "Streptococcus pneumoniae",
    assembly: "70585 (ASM1896v1)",
  },
  {
    id: "sav_asm976v2",
    name: "Streptomyces avermitilis",
    assembly: "MA4680 (ASM976v2)",
  },
  {
    id: "scl_gcf_005519465",
    name: "Streptomyces clavuligerus",
    assembly: "ATCC 27064 (GCF_005519465)",
  },
  {
    id: "sco_asm20383v1",
    name: "Streptomyces coelicolor",
    assembly: "A3(2) (ASM20383v1)",
  },
  {
    id: "sgr_gca_000010605",
    name: "Streptomyces griseus",
    assembly: "JCM 4626 (GCA_000010605)",
  },
  {
    id: "sli_asm73910v1",
    name: "Streptomyces lividans",
    assembly: "TK24 (ASM73910v1)",
  },
  {
    id: "sts_gcf_003932715",
    name: "Streptomyces tsukubensis",
    assembly: "NRRL 18488 (GCF_003932715)",
  },
  {
    id: "sve_asm25323v1",
    name: "Streptomyces venezuelae",
    assembly: "ATCC 10712 (ASM25323v1)",
  },
  {
    id: "ssp_asm47882v2",
    name: "Synechocystis sp.",
    assembly: "PCC 6714 (ASM47882v2)",
  },
  {
    id: "vna_asm168008v1",
    name: "Vibrio natriegens",
    assembly: "CCUG 16374 (ASM168008v1)",
  },
  {
    id: "vvu_asm3976v1",
    name: "Vibrio vulnificus",
    assembly: "CMCP6 (ASM3976v1)",
  },
  { id: "zmo_asm710v1", name: "Zymomonas mobilis", assembly: "ZM4 (ASM710v1)" },
];

