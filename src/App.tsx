// src/App.tsx
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MainLayout } from '@/layout/MainLayout';
import { LoadingScreen } from '@/components/shared/LoadingScreen';
import { SetupModule } from '@/modules/Setup/SetupModule';
import { PsiteModule } from '@/modules/Psite/PsiteModule';
import { QCModule } from '@/modules/QC/QCModule';
import { CodonModule } from '@/modules/Codon/CodonModule';
import { MetaViewModule } from '@/modules/MetaView/MetaViewModule';
import { OrfPauseModule } from '@/modules/OrfPause/OrfPauseModule';
import { ToolsModule } from '@/modules/Tools/ToolsModule';
import { AboutModule } from '@/modules/About/AboutModule';

function App() {
  const [currentModule, setCurrentModule] = useState('Setup');
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-full w-full bg-app-bg">
      <AnimatePresence mode="wait">
        {isBooting ? (
          <LoadingScreen key="loader" />
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="h-full w-full"
          >
            <MainLayout activeModule={currentModule} onModuleChange={setCurrentModule}>
              {currentModule === 'Setup' && (
                <SetupModule onNavigate={() => setCurrentModule('Psite')} />
              )}
              {currentModule === 'Psite' && <PsiteModule />}
              {currentModule === 'QC' && <QCModule />}
              {currentModule === 'Codon' && <CodonModule />}
              {currentModule === 'MetaView' && <MetaViewModule />}
              {currentModule === 'OrfPause' && <OrfPauseModule />}
              {currentModule === 'Tools' && <ToolsModule />}
              {currentModule === 'About' && <AboutModule />}
            </MainLayout>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
