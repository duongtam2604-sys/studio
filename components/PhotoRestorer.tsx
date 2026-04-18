
import React, { useState, useMemo, useRef } from 'react';
import { PhotoUploader } from './PhotoUploader';
import { ComparisonSlider } from './ComparisonSlider';
import { Loader } from './Loader';
import { FaceIcon } from './icons/FaceIcon';
import { NoiseIcon } from './icons/NoiseIcon';
import { SharpenIcon } from './icons/SharpenIcon';
import { UpscaleIcon } from './icons/UpscaleIcon';
import { ColorizeIcon } from './icons/ColorizeIcon';
import { BrushIcon } from './icons/BrushIcon';
import { EraserIcon } from './icons/EraserIcon';
import { SelectionCanvas, SelectionCanvasRef } from './SelectionCanvas';
import { restorePhoto, analyzeImageForRestoration, upscaleImage } from '../services/geminiService';
import { dataUrlToFile } from '../utils/imageUtils';
import { RestorationAnalysisFeedback } from './RestorationAnalysisFeedback';

type RestoreOption = 'faceEnhance' | 'denoise' | 'sharpen' | 'upscale' | 'colorize';
type SelectionTool = 'brush' | 'eraser';

interface ProcessedImage {
  id: number;
  originalUrl: string;
  restoredUrl: string;
}

interface AnalysisResult {
    needsUpscaling: boolean;
    reason: string;
}

export const PhotoRestorer: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeControlTab, setActiveControlTab] = useState<'enhance' | 'selection'>('enhance');
  
  const [options, setOptions] = useState({
    faceEnhance: true,
    denoise: true,
    sharpen: false,
    upscale: false,
    colorize: false,
  });

  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg'>('png');
  const [imageQueue, setImageQueue] = useState<ProcessedImage[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [lastRestoreUsedMask, setLastRestoreUsedMask] = useState(false);

  // Selection state
  const canvasRef = useRef<SelectionCanvasRef>(null);
  const [selectionTool, setSelectionTool] = useState<SelectionTool>('brush');
  const [brushSize, setBrushSize] = useState(30);

  // Upscaling flow state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaledImageFile, setUpscaledImageFile] = useState<File | null>(null);

  const uploadedImagePreview = useMemo(() => {
    if (!uploadedImage) return null;
    return URL.createObjectURL(uploadedImage);
  }, [uploadedImage]);

  const upscaledImagePreview = useMemo(() => {
    if (!upscaledImageFile) return null;
    return URL.createObjectURL(upscaledImageFile);
  }, [upscaledImageFile]);

  const performAnalysis = async (imageFile: File) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await analyzeImageForRestoration(imageFile);
      setAnalysisResult(result);
      if (result.needsUpscaling) {
        setOptions(prev => ({ ...prev, upscale: true }));
      }
    } catch (e) {
      console.error("Image analysis for restoration failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setUploadedImage(null);
    setRestoredImage(null);
    setIsLoading(false);
    setError(null);
    setOptions({ faceEnhance: true, denoise: true, sharpen: false, upscale: false, colorize: false });
    setImageQueue([]);
    setCustomPrompt('');
    setActiveControlTab('enhance');
    canvasRef.current?.clearSelection();
    setLastRestoreUsedMask(false);
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setIsUpscaling(false);
    setUpscaledImageFile(null);
  };

  const handleImageUpload = (file: File) => {
    handleReset();
    setUploadedImage(file);
    performAnalysis(file);
  };

  const toggleOption = (option: RestoreOption) => {
    setOptions(prev => ({ ...prev, [option]: !prev[option] }));
  };

  const handleUpscaleAndSet = async () => {
      if (!uploadedImage) return;
      setIsUpscaling(true);
      setError(null);
      try {
          const result = await upscaleImage(uploadedImage);
          if (result.image) {
              const file = await dataUrlToFile(result.image, 'upscaled_image.png');
              setUpscaledImageFile(file);
              setAnalysisResult({ needsUpscaling: false, reason: 'Ảnh đã được nâng cấp thành công!'});
              setOptions(prev => ({ ...prev, upscale: false })); // Turn off upscale option as it's done
          } else {
              setError(result.text || 'Không thể nâng cấp ảnh.');
          }
      } catch(e) {
          console.error(e);
          setError(e instanceof Error ? e.message : 'Lỗi không mong muốn khi nâng cấp ảnh.');
      } finally {
          setIsUpscaling(false);
      }
  };

  const handleRestore = async () => {
    const imageToRestore = upscaledImageFile || uploadedImage;
    if (!imageToRestore) {
      setError("Vui lòng tải ảnh lên trước.");
      return;
    }
    setIsLoading(true);
    setError(null);

    let maskDataUrl: string | null = null;
    if (activeControlTab === 'selection') {
      maskDataUrl = await canvasRef.current?.getMaskDataUrl() || null;
      if (!maskDataUrl) {
          setError('Vui lòng chọn một vùng trên ảnh để phục hồi bằng bút vẽ.');
          setIsLoading(false);
          return;
      }
    }
    setLastRestoreUsedMask(!!maskDataUrl);

    try {
      const result = await restorePhoto(imageToRestore, options, customPrompt, maskDataUrl);
      if (result.image) {
        setRestoredImage(result.image);
        const originalDisplayUrl = upscaledImagePreview || uploadedImagePreview;
        if(originalDisplayUrl) {
            const newHistory: ProcessedImage = {
                id: Date.now(),
                originalUrl: originalDisplayUrl,
                restoredUrl: result.image,
            };
            setImageQueue(prev => [newHistory, ...prev].slice(0, 5));
        }
      } else {
        setError(result.text || 'Không thể phục hồi ảnh. Yêu cầu của bạn có thể đã bị AI từ chối.');
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi không mong muốn.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!restoredImage) return;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = restoredImage;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (restoredImage.startsWith('data:image/png') && downloadFormat === 'jpg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(image, 0, 0);
        const imageUrl = canvas.toDataURL(`image/${downloadFormat === 'jpg' ? 'jpeg' : 'png'}`, 1.0);
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `restored-photo.${downloadFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };
  };
  
  const mainDisplayContent = () => {
    const displayUrl = upscaledImagePreview || uploadedImagePreview;
    
    if (!displayUrl) {
      return <PhotoUploader onImageUpload={handleImageUpload} previewUrl={null} />;
    }
    
    return (
      <div className="w-full h-full relative">
        {restoredImage ? (
           <ComparisonSlider originalImageUrl={displayUrl} generatedImageUrl={restoredImage} />
        ) : (
          <img src={displayUrl} alt="Uploaded" className="object-contain w-full h-full rounded-lg" />
        )}

        {activeControlTab === 'selection' && displayUrl && !restoredImage && (
            <SelectionCanvas 
                ref={canvasRef}
                imageUrl={displayUrl}
                tool={selectionTool}
                brushSize={brushSize}
            />
        )}
      </div>
    );
  };

  const restoreOptions: { id: RestoreOption; name: string; icon: React.FC<any> }[] = [
    { id: 'faceEnhance', name: 'Nâng cấp khuôn mặt', icon: FaceIcon },
    { id: 'denoise', name: 'Khử nhiễu', icon: NoiseIcon },
    { id: 'sharpen', name: 'Làm nét', icon: SharpenIcon },
    { id: 'colorize', name: 'Tô màu', icon: ColorizeIcon },
    { id: 'upscale', name: 'Tăng chi tiết (4K)', icon: UpscaleIcon }, // Updated Label
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200">
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">Phục Hồi Ảnh Cũ Bằng AI</h2>
          <p className="mt-3 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Tự động sửa chữa vết xước, làm rõ nét và tô màu cho những bức ảnh kỷ niệm của bạn.</p>
        </div>
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-3 sticky top-24">
              <div className="aspect-square relative flex items-center justify-center bg-white dark:bg-slate-800/50 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-2">
                {isLoading && <Loader />}
                {mainDisplayContent()}
              </div>
              {uploadedImage && (isAnalyzing || analysisResult) && !upscaledImageFile && (
                <RestorationAnalysisFeedback result={analysisResult} isAnalyzing={isAnalyzing} isUpscaling={isUpscaling} onUpscale={handleUpscaleAndSet} />
              )}
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button 
                  onClick={() => setActiveControlTab('enhance')}
                  className={`flex-1 pb-2 text-sm font-semibold transition-colors ${activeControlTab === 'enhance' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  Tăng cường
                </button>
                <button 
                  onClick={() => setActiveControlTab('selection')}
                  className={`flex-1 pb-2 text-sm font-semibold transition-colors ${activeControlTab === 'selection' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  Chỉnh sửa vùng chọn
                </button>
              </div>

              {activeControlTab === 'enhance' ? (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tùy chọn phục hồi</label>
                  <div className="grid grid-cols-2 gap-3">
                    {restoreOptions.map(opt => {
                      const isSelected = options[opt.id];
                      return (
                        <button key={opt.id} onClick={() => toggleOption(opt.id)} className={`flex items-center p-3 border rounded-lg text-left transition-colors ${isSelected ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500' : 'border-slate-300 bg-white hover:border-slate-400 dark:bg-slate-800/50 dark:border-slate-600 dark:hover:border-slate-500'}`}>
                          <opt.icon className={`w-5 h-5 mr-3 flex-shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{opt.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-lg">
                  <div>
                    <h3 className="text-base font-semibold mb-2 text-slate-800 dark:text-slate-100">Công cụ</h3>
                    <div className="flex items-center bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                      <button onClick={() => setSelectionTool('brush')} className={`flex-1 flex items-center justify-center py-1.5 text-sm rounded-md font-semibold transition-colors ${selectionTool === 'brush' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-600/70'}`}><BrushIcon className="w-5 h-5 mr-2"/> Bút vẽ</button>
                      <button onClick={() => setSelectionTool('eraser')} className={`flex-1 flex items-center justify-center py-1.5 text-sm rounded-md font-semibold transition-colors ${selectionTool === 'eraser' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-600/70'}`}><EraserIcon className="w-5 h-5 mr-2"/> Tẩy</button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="brush-size" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Kích thước: {brushSize}px</label>
                    <input id="brush-size" type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  </div>
                  <button onClick={() => canvasRef.current?.clearSelection()} className="w-full text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-800 dark:hover:text-blue-300">Xóa vùng chọn</button>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Tô lên vùng ảnh bạn muốn AI phục hồi.</p>
                </div>
              )}
               <div>
                <label htmlFor="restore-prompt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Yêu cầu thêm (tùy chọn)</label>
                <textarea id="restore-prompt" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="Ví dụ: làm cho màu áo xanh hơn, xóa vật thể..." className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" rows={2}/>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                {error && <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm" role="alert"><p className="font-bold">Đã xảy ra lỗi</p><p>{error}</p></div>}
                {restoredImage ? (
                  <div className="space-y-3">
                    <button onClick={handleDownload} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center text-base shadow"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg> Tải xuống ({downloadFormat.toUpperCase()})</button>
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                      <button onClick={() => setDownloadFormat('png')} className={`flex-1 text-center py-1.5 text-sm rounded-md font-semibold transition-colors ${downloadFormat === 'png' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>PNG</button>
                      <button onClick={() => setDownloadFormat('jpg')} className={`flex-1 text-center py-1.5 text-sm rounded-md font-semibold transition-colors ${downloadFormat === 'jpg' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>JPG</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={handleRestore} disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300">{isLoading ? 'Đang xử lý...' : 'Thử lại'}</button>
                      <button onClick={handleReset} className="w-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-100 text-center font-bold py-3 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Tạo mới</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleRestore} disabled={!uploadedImage || isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center text-base shadow">{isLoading ? 'Đang phục hồi...' : 'Bắt đầu phục hồi'}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
