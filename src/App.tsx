// src/App.tsx
import { useState, useEffect } from 'react';
import { MainLayout } from '@/layout/MainLayout';
import { SetupModule } from '@/modules/Setup/SetupModule';
import { PsiteModule } from '@/modules/Psite/PsiteModule';
import { QCModule } from '@/modules/QC/QCModule'; 
import { CodonModule } from '@/modules/Codon/CodonModule'; // 新增：导入 Codon 模块
import { AboutModule } from '@/modules/About/AboutModule'; // 新增：导入 About 模块
import { MetaViewModule } from '@/modules/MetaView/MetaViewModule';
import { LoadingScreen } from '@/components/shared/LoadingScreen'; 
import { AnimatePresence, motion } from 'framer-motion';

/**
 * RiboMeta 根组件
 * 处理系统引导与全局模块切换
 */
function App() {
  const [currentModule, setCurrentModule] = useState('Setup');
  const [isBooting, setIsBooting] = useState(true);

  // 模拟引擎初始化过程：符合 Fresh Academic Style 的系统加载体验
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
              
              {/* 1. 配置模块：初始化路径与物种映射 */}
              {currentModule === 'Setup' && (
                <SetupModule onNavigate={() => setCurrentModule('Psite')} />
              )}

              {/* 2. P-site 校准模块：处理多锚点分层分析 */}
              {currentModule === 'Psite' && <PsiteModule />}

              {/* 3. QC 质控模块：展示文库质量与读段分布 */}
              {currentModule === 'QC' && <QCModule />}

              {/* 4. Codon 模块：密码子使用率与 Metacodon 分析 (已集成) */}
              {currentModule === 'Codon' && <CodonModule />}

              {/* 5. 关于模块：软件介绍与帮助文档 (新增集成) */}
              {currentModule === 'MetaView' && <MetaViewModule />}
              {currentModule === 'About' && <AboutModule />}

              {/* 6. 结果浏览器模块占位 */}
            </MainLayout>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
