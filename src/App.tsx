import { useEffect, useState } from "react";
import { MainLayout } from "@/layout/MainLayout";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { HelpModule } from "@/modules/Help/HelpModule";
import { isHelpPageId } from "@/modules/Help/helpModuleDefinitions";
import { SetupModule } from "@/modules/Setup/SetupModule";
import { UploadRunModule } from "@/modules/UploadRun/UploadRunModule";
import { MetaPlotModule } from "@/modules/MetaPlot/MetaPlotModule";
import { PeakDistributionModule } from "@/modules/PeakDistribution/PeakDistributionModule";
import { GeneTypeModule } from "@/modules/GeneType/GeneTypeModule";
import { PeakGeneSizeModule } from "@/modules/PeakGeneSize/PeakGeneSizeModule";
import { GeneMatrixModule } from "@/modules/GeneMatrix/GeneMatrixModule";
import { PeakExonSizeModule } from "@/modules/PeakExonSize/PeakExonSizeModule";
import { PeakExonTypeModule } from "@/modules/PeakExonType/PeakExonTypeModule";
import { PeakExonNumModule } from "@/modules/PeakExonNum/PeakExonNumModule";
import { SplicesiteModule } from "@/modules/Splicesite/SplicesiteModule";
import { TranscriptionModule } from "@/modules/Transcription/TranscriptionModule";
import { TranslationModule } from "@/modules/Translation/TranslationModule";

function App() {
  const [activeModule, setActiveModule] = useState("setup");
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsBooting(false);
    }, 900);

    return () => window.clearTimeout(timer);
  }, []);

  if (isBooting) {
    return <LoadingScreen />;
  }

  return (
    <MainLayout activeModule={activeModule} onModuleChange={setActiveModule}>
      {activeModule === "setup" ? (
        <SetupModule onNavigate={(moduleId) => setActiveModule(moduleId)} />
      ) : null}
      {activeModule === "upload-run" ? <UploadRunModule /> : null}
      {activeModule === "meta-plot" ? <MetaPlotModule /> : null}
      {activeModule === "peak-distribution" ? <PeakDistributionModule /> : null}
      {activeModule === "gene-type" ? <GeneTypeModule /> : null}
      {activeModule === "peak-gene-size" ? <PeakGeneSizeModule /> : null}
      {activeModule === "gene-matrix" ? <GeneMatrixModule /> : null}
      {activeModule === "peak-exon-size" ? <PeakExonSizeModule /> : null}
      {activeModule === "peak-exon-type" ? <PeakExonTypeModule /> : null}
      {activeModule === "peak-exon-num" ? <PeakExonNumModule /> : null}
      {activeModule === "transcription" ? <TranscriptionModule /> : null}
      {activeModule === "translation" ? <TranslationModule /> : null}
      {activeModule === "splicesite" ? <SplicesiteModule /> : null}
      {isHelpPageId(activeModule) ? (
        <HelpModule activePage={activeModule} onNavigate={setActiveModule} />
      ) : null}
    </MainLayout>
  );
}

export default App;
