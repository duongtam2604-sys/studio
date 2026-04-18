
import React, { useState, useMemo, useRef } from 'react';
import { PhotoUploader, PhotoUploaderRef } from './PhotoUploader';
import { Loader } from './Loader';
import { generateTattooSketch, refineTattooSketch, upscaleImage } from '../services/geminiService';
import { dataUrlToFile } from '../utils/imageUtils';
import { UploadIcon } from './icons/UploadIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { WandIcon } from './icons/WandIcon';
import { SparklesIcon } from './icons/SparklesIcon';

export const TattooSketchGenerator: React.FC = () => {
    const [uploadedImage, setUploadedImage] = useState<File | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isRefined, setIsRefined] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isUltraHD, setIsUltraHD] = useState<boolean>(false);
    const uploaderRef = useRef<PhotoUploaderRef>(null);

    const uploadedImagePreview = useMemo(() => {
        if (!uploadedImage) return null;
        return URL.createObjectURL(uploadedImage);
    }, [uploadedImage]);
    
    const handleReset = () => {
        setUploadedImage(null);
        setGeneratedImage(null);
        setIsRefined(false);
        setIsLoading(false);
        setError(null);
        setIsUltraHD(false);
    };

    const handleImageUpload = (file: File) => {
        handleReset();
        setUploadedImage(file);
    };

    const processResult = async (image: string) => {
        if (isUltraHD) {
            const file = await dataUrlToFile(image, 'tattoo_sketch.png');
            const upscaleResult = await upscaleImage(file, 'sketch');
            if (upscaleResult.image) {
                return upscaleResult.image;
            }
        }
        return image;
    }

    const handleConvert = async () => {
        if (!uploadedImage) {
            setError("Vui lòng tải ảnh lên trước.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);
        setIsRefined(false);

        try {
            const result = await generateTattooSketch(uploadedImage);
            if (result.image) {
                const finalImage = await processResult(result.image);
                setGeneratedImage(finalImage);
            } else {
                setError(result.text || 'Không thể tạo nét vẽ. Yêu cầu của bạn có thể đã bị AI từ chối.');
            }
        } catch (e: unknown) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi không mong muốn.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRefine = async () => {
        if (!generatedImage) {
            setError("Không có ảnh để làm nét.");
            return;
        }
        setIsLoading(true);
        setError(null);
        
        try {
            const result = await refineTattooSketch(generatedImage);
            if (result.image) {
                const finalImage = await processResult(result.image);
                setGeneratedImage(finalImage);
                setIsRefined(true);
            } else {
                 setError(result.text || 'Không thể làm nét ảnh. Yêu cầu của bạn có thể đã bị AI từ chối.');
            }
        } catch (e: unknown) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi không mong muốn khi làm nét ảnh.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handlePrimaryAction = () => {
        if (generatedImage && !isRefined) {
            handleRefine();
        } else {
            handleConvert();
        }
    };

    const handleDownload = () => {
        if (!generatedImage) return;
        const a = document.createElement('a');
        a.href = generatedImage;
        a.download = `tattoo-sketch${isRefined ? '-hd' : ''}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200">
            <main className="container mx-auto px-4 py-8 sm:py-12">
                <div className="text-center mb-8 sm:mb-10">
                    <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">Tạo Nét Vẽ AI từ Hình Xăm</h2>
                    <p className="mt-3 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Tải lên ảnh hình xăm và để AI tự động tách nét vẽ cho bạn trong vài giây.</p>
                </div>

                <div className="max-w-4xl mx-auto p-6 sm:p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700">
                    <div className="grid md:grid-cols-2 gap-6 items-start">
                        {/* Original Image */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-center text-slate-700 dark:text-slate-200">Ảnh Gốc</h3>
                             <div className="w-full aspect-square bg-white dark:bg-slate-800/50 p-1.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg shadow-inner">
                                <PhotoUploader ref={uploaderRef} onImageUpload={handleImageUpload} previewUrl={uploadedImagePreview} />
                            </div>
                        </div>

                        {/* Generated Image */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-center text-slate-700 dark:text-slate-200">Ảnh Nét Vẽ</h3>
                             <div className="w-full aspect-square relative bg-slate-50 dark:bg-slate-900/50 p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg shadow-inner flex items-center justify-center">
                                {isLoading && <Loader />}
                                {generatedImage && !isLoading && (
                                    <img src={generatedImage} alt="Generated sketch" className="object-contain max-w-full max-h-full rounded-md" />
                                )}
                                {!generatedImage && !isLoading && (
                                    <div className="text-center text-slate-500 dark:text-slate-400">
                                        <p>Kết quả sẽ hiện ở đây</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-center">
                        <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 w-full sm:w-auto">
                            <label htmlFor="ultra-hd-tattoo-toggle" className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 cursor-pointer select-none mr-4">
                                <span className="flex items-center justify-center w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full">4K</span>
                                Chế độ Ultra HD (4K)
                            </label>
                            <div 
                                className="relative inline-flex items-center cursor-pointer"
                                onClick={() => setIsUltraHD(!isUltraHD)}
                            >
                                <input 
                                    type="checkbox" 
                                    id="ultra-hd-tattoo-toggle" 
                                    className="sr-only peer" 
                                    checked={isUltraHD} 
                                    readOnly
                                />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button
                            onClick={() => uploaderRef.current?.triggerClick()}
                            className="w-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 border border-slate-300 dark:border-slate-600 font-bold py-3 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                        >
                           <UploadIcon className="w-5 h-5" />
                            Chọn Ảnh
                        </button>
                        <button
                            onClick={handlePrimaryAction}
                            disabled={!uploadedImage || isLoading || isRefined}
                            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 dark:disabled:bg-blue-800/50 disabled:cursor-not-allowed shadow-md shadow-blue-500/30 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                    <span>{isUltraHD ? 'Đang xử lý & nâng cấp...' : 'Đang xử lý...'}</span>
                                </>
                            ) : (
                                <>
                                    {generatedImage && !isRefined ? <SparklesIcon className="w-5 h-5"/> : <WandIcon className="w-5 h-5"/>}
                                    <span>{generatedImage && !isRefined ? 'Làm Nét Thêm' : 'Chuyển Đổi'}</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={!generatedImage || isLoading}
                            className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400 dark:disabled:bg-green-800/50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Tải Xuống
                        </button>
                    </div>
                    {generatedImage && <button onClick={handleReset} className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 mt-4 underline">Tạo mới</button>}

                    {error && (
                        <div className="mt-6 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-500/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm text-center" role="alert">
                            <p className="font-bold">Đã xảy ra lỗi</p>
                            <p>{error}</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
