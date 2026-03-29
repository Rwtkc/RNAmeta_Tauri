export interface SpeciesOption {
  label: string;
  name: string;
  assembly: string;
  id: string;
}

const RAW_SPECIES = [
  "Arabidopsis thaliana(ara_TAIR10)",
  "Arachis_hypogaea(ahy_tifrunner2)",
  "Brachypodium distachyon(bdi_v3)",
  "Caenorhabditis elegans(cel_WBcel235)",
  "Drosophila melanogaster(dme_BDGP6)",
  "Danio rerio(dre_GRCz11)",
  "Gallus gallus(gga_GRCg6a)",
  "Gorilla gorilla(ggo_gorGor4)",
  "Glycine max(gma_v2)",
  "Homo sapiens 19(hg19)",
  "Homo sapiens 38(hg38)",
  "Mus musculus 10(mm10)",
  "Macaca mulatta(mmu_Mmul_8)",
  "Medicago truncatula(mtr_MedtrA17_4)",
  "Oryza sativa(osa_IRGSP_1)",
  "Oryza rufipogon(OR_W1943)",
  "Populus trichocarpa(ptc_v3)",
  "Pan troglodytes(ptr_v3)",
  "Rattus norvegicus(rn6)",
  "Sorghum bicolor(sbi_v3)",
  "Saccharomyces cerevisiae(sce_R64)",
  "Sus scrofa(ssc_Sscrofa11)",
  "Vitis vinifera(vvi_12X)",
  "Zea mays(zma_RefGen_v4)"
] as const;

const SPECIES_OVERRIDES: Record<string, Partial<SpeciesOption>> = {
  "Oryza rufipogon(OR_W1943)": {
    assembly: "OR_W1943",
    id: "osa_rufipogon"
  }
};

function parseSpeciesLabel(label: string): SpeciesOption {
  const match = label.match(/^(.*)\(([^()]+)\)$/);

  if (!match) {
    return {
      label,
      name: label,
      assembly: label,
      id: label
    };
  }

  return {
    label,
    name: match[1],
    assembly: SPECIES_OVERRIDES[label]?.assembly ?? match[2],
    id: SPECIES_OVERRIDES[label]?.id ?? match[2]
  };
}

export const SPECIES_OPTIONS: SpeciesOption[] = RAW_SPECIES.map(parseSpeciesLabel);
