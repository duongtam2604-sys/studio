
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { IdPhotoGenerator } from './components/IdPhotoGenerator';
import { PhotoRestorer } from './components/PhotoRestorer';
import { ProAiRelight } from './components/pro-ai-relight/ProAiRelight';
import { ImageGenerator } from './components/ImageGenerator';
import { ConceptPhotoGenerator } from './components/concept-photo/ConceptPhotoGenerator';
import { ObjectCleaner } from './components/ObjectCleaner';
import { TattooSketchGenerator } from './components/TattooSketchGenerator';
import { CaricatureGenerator } from './components/CaricatureGenerator';
import { ChibiPoseGenerator } from './components/ChibiPoseGenerator';
import { StudentIdCardGenerator } from './components/StudentIdCardGenerator';
import { SmartPhotoSorter } from './components/SmartPhotoSorter';

type ActiveApp = 'conceptPhoto' | 'idPhoto' | 'chibiPoses' | 'caricature' | 'photoRestorer' | 'objectCleaner' | 'tattooSketch' | 'proAiRelight' | 'imageGenerator' | 'studentId' | 'photoSorter';
export type Theme = 'light' | 'dark';

export default function App() {
  const [activeApp, setActiveApp] = useState<ActiveApp>('conceptPhoto');
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : (prefersDark ? 'dark' : 'light');
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const apps = [
    { id: 'conceptPhoto', component: <ConceptPhotoGenerator />, name: 'Tạo Concept' },
    { id: 'idPhoto', component: <IdPhotoGenerator />, name: 'Ảnh Thẻ' },
    { id: 'chibiPoses', component: <ChibiPoseGenerator />, name: 'Dáng Chibi' },
    { id: 'caricature', component: <CaricatureGenerator />, name: 'Biếm Họa' },
    { id: 'photoRestorer', component: <PhotoRestorer />, name: 'Phục Hồi Cũ' },
    { id: 'objectCleaner', component: <ObjectCleaner />, name: 'Làm Sạch Vật Thể' },
    { id: 'tattooSketch', component: <TattooSketchGenerator />, name: 'Ảnh Nét Vẽ' },
    { id: 'proAiRelight', component: <ProAiRelight />, name: 'Ánh Sáng' },
    { id: 'studentId', component: <StudentIdCardGenerator />, name: 'Thẻ Sinh Viên' },
    { id: 'photoSorter', component: <SmartPhotoSorter />, name: 'Lọc Ảnh' },
    { id: 'imageGenerator', component: <ImageGenerator />, name: 'Vẽ Ảnh AI' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300 flex flex-col">
      <Header theme={theme} toggleTheme={toggleTheme} />

      <nav className="bg-white dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 sticky top-[65px] z-40">
        <div className="container mx-auto px-4 py-2">
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1">
                 {apps.map(app => (
                    <button
                        key={app.id}
                        onClick={() => setActiveApp(app.id as ActiveApp)}
                        className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-200 whitespace-nowrap ${
                            activeApp === app.id 
                              ? 'bg-blue-600 text-white shadow-md' 
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        {app.name}
                    </button>
                 ))}
            </div>
        </div>
      </nav>

      <div className="flex-grow">
        {apps.map(app => (
            <div key={app.id} style={{ display: activeApp === app.id ? 'block' : 'none' }}>
                {app.component}
            </div>
        ))}
      </div>
      
      <footer className="text-center mt-10 pb-12 text-slate-500 dark:text-slate-400 text-sm bg-slate-50 dark:bg-slate-900/50 pt-8 border-t border-slate-200 dark:border-slate-800">
          <div className="container mx-auto px-4 max-w-4xl">
              <p className="mb-4">Tam Duho - Liên hệ kỹ thuật: 0877.600.601. Ứng dụng sử dụng công nghệ AI tiên tiến để xử lý hình ảnh.</p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                  <p className="text-slate-700 dark:text-slate-300 font-bold text-lg">Tam Duho Studio © 2024</p>
                  <a 
                      href="tel:0877600601" 
                      className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                  >
                      Hỗ Trợ Kỹ Thuật
                  </a>
              </div>
          </div>
      </footer>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
