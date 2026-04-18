
import React, { useState, useMemo } from 'react';
import { PhotoUploader } from './PhotoUploader';
import { Loader } from './Loader';
import { generateChibiPoseCollage, upscaleImage } from '../services/geminiService';
import { dataUrlToFile } from '../utils/imageUtils';
import { SparklesIcon } from './icons/SparklesIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ZoomModal } from './ZoomModal';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { OptionSelector } from './OptionSelector';
import type { Option } from '../types';

interface UploadedFile {
    id: string;
    file: File;
    preview: string;
}

// FIX: Define ChibiTheme interface to satisfy Option constraint and fix TS inference error
interface ChibiTheme extends Option {
    description: string;
}

const CHIBI_THEMES: ChibiTheme[] = [
    { id: 'modern', name: 'Hiện đại (Váy trắng, Vest đen)', description: 'Phong cách cưới quốc tế hiện đại, sang trọng.' },
    { id: 'traditional-red', name: 'Truyền thống (Áo dài đỏ)', description: 'Phong cách lễ cưới hỏi truyền thống Việt Nam.' },
    { id: 'traditional-white', name: 'Truyền thống (Áo dài trắng)', description: 'Vẻ đẹp tinh khôi, dịu dàng của áo dài Việt.' },
    { id: 'vintage', name: 'Cổ điển (Vintage/Retro)', description: 'Phong cách hoài niệm, đồ Âu phục cổ.' },
    { id: 'graphite', name: 'Nét vẽ than chì (Pencil)', description: 'Chỉ giữ lại đường nét tư thế đen trắng, không màu sắc.' },
    { id: 'cute-minimal', name: 'Tối giản & Đáng yêu', description: 'Đường nét đơn giản, tập trung vào cảm xúc.' },
];

const LAYOUTS = [
    { id: 'vertical', name: 'Khổ Dọc (Dùng cho điện thoại)' },
    { id: 'horizontal', name: 'Khổ Ngang (Dùng để in/máy tính)' },
];

export const ChibiPoseGenerator: React.FC = () => {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [isUpscaling, setIsUpscaling] = useState(false);

    // FIX: Explicitly type selectedTheme state
    const [selectedTheme, setSelectedTheme] = useState<ChibiTheme>(CHIBI_THEMES[0]);
    const [characterNote, setCharacterNote] = useState("");
    const [selectedLayout, setSelectedLayout] = useState(LAYOUTS[0]);

    const handleBatchUpload = (files: File[]) => {
        const newFiles = files.slice(0, 10 - uploadedFiles.length).map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            preview: URL.createObjectURL(file)
        }));
        setUploadedFiles(prev => [...prev, ...newFiles]);
        setError(null);
    };

    const removeFile = (id: string) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleGenerate = async () => {
        if (uploadedFiles.length === 0) {
            setError("Vui lòng tải lên ít nhất 1 ảnh mẫu dáng.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResultImage(null);
        setStatusMessage("Đang phân tích số lượng người và dáng...");

        try {
            const files = uploadedFiles.map(f => f.file);
            
            const timer = setTimeout(() => {
                setStatusMessage(`Đang vẽ phong cách ${selectedTheme.name}...`);
            }, 4000);

            const result = await generateChibiPoseCollage(files, {
                theme: selectedTheme.name,
                description: characterNote,
                layout: selectedLayout.name,
                themeId: selectedTheme.id
            });
            
            clearTimeout(timer);
            
            if (result.image) {
                setResultImage(result.image);
            } else {
                setError(result.text || "AI không thể tạo ảnh từ các mẫu này.");
            }
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Đã có lỗi xảy ra trong quá trình xử lý.");
        } finally {
            setIsLoading(false);
            setStatusMessage("");
        }
    };

    const handleUpscale = async () => {
        if (!resultImage) return;

        // FIX: Implement mandatory API key selection for Gemini 3 models (used in upscaleImage)
        try {
            const aiStudio = (window as any).aistudio;
            if (aiStudio && !(await aiStudio.hasSelectedApiKey())) {
                await aiStudio.openSelectKey();
            }
        } catch (err) {
            console.error("API Key selection failed", err);
        }

        setIsUpscaling(true);
        try {
            const file = await dataUrlToFile(resultImage, 'chibi_poses_guide.png');
            const result = await upscaleImage(file, 'general');
            if (result.image) {
                setResultImage(result.image);
            }
        } catch (e: any) {
            console.error(e);
            // Reset key selection if entity not found error occurs as per guidelines
            if (e.message?.includes("Requested entity was not found.")) {
                const aiStudio = (window as any).aistudio;
                if (aiStudio) await aiStudio.openSelectKey();
            }
        } finally {
            setIsUpscaling(false);
        }
    };

    const handleDownload = () => {
        if (!resultImage) return;
        const a = document.createElement('a');
        a.href = resultImage;
        a.download = `chibi-wedding-poses-${selectedTheme.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleReset = () => {
        setUploadedFiles([]);
        setResultImage(null);
        setError(null);
        setStatusMessage("");
        setCharacterNote("");
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200">
            <main className="container mx-auto px-4 py-8 sm:py-12">
                <div className="text-center mb-8 sm:mb-12">
                    <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-3">
                        <SparklesIcon className="w-8 h-8 text-purple-500" />
                        Cẩm Nang Dáng Chibi Cưới
                    </h2>
                    <p className="mt-3 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                        Biến các ảnh chụp mẫu thành bảng hướng dẫn Chibi chuyên nghiệp theo phong cách riêng của bạn.
                    </p>
                </div>

                <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_450px] gap-8 lg:gap-12 items-start">
                    {/* Controls */}
                    <div className="space-y-8">
                        {/* Step 1: Upload */}
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm">1</span>
                                    Tải ảnh mẫu tư thế ({uploadedFiles.length}/10)
                                </h3>
                                {uploadedFiles.length > 0 && (
                                    <button onClick={() => setUploadedFiles([])} className="text-xs font-bold text-red-500 hover:text-red-600 uppercase tracking-wider">Xóa hết</button>
                                )}
                            </div>

                            <PhotoUploader 
                                onImageUpload={() => {}} 
                                onBatchUpload={handleBatchUpload}
                                previewUrl={null}
                                allowMultiple={true}
                            />
                            
                            {uploadedFiles.length > 0 && (
                                <div className="mt-6 grid grid-cols-5 gap-3 max-h-[250px] overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    {uploadedFiles.map(file => (
                                        <div key={file.id} className="relative aspect-square group animate-fade-in">
                                            <img src={file.preview} alt="preview" className="w-full h-full object-cover rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm" />
                                            <button 
                                                onClick={() => removeFile(file.id)}
                                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                            >
                                                <TrashIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Step 2: Customization */}
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
                                Tùy chỉnh phong cách cẩm nang
                            </h3>

                            <div className="space-y-4">
                                {/* FIX: Explicitly pass ChibiTheme type to fix TS error on line 202 */}
                                <OptionSelector<ChibiTheme>
                                    label="Chọn phong cách Chibi"
                                    options={CHIBI_THEMES}
                                    selectedOption={selectedTheme}
                                    onSelect={setSelectedTheme}
                                    renderOption={(opt) => (
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{opt.name}</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{opt.description}</p>
                                        </div>
                                    )}
                                />

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Đặc điểm nhân vật (Tùy chọn)</label>
                                    <textarea 
                                        value={characterNote}
                                        onChange={(e) => setCharacterNote(e.target.value)}
                                        placeholder="Ví dụ: Cô dâu tóc ngắn ngang vai, Chú rể đeo kính cận, Cô dâu cầm hoa hồng đỏ..."
                                        className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                                        rows={2}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Bố cục trang</label>
                                        <div className="flex gap-2">
                                            {LAYOUTS.map(l => (
                                                <button
                                                    key={l.id}
                                                    onClick={() => setSelectedLayout(l)}
                                                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                                                        selectedLayout.id === l.id 
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    {l.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1 flex items-end">
                                         <div className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex items-center gap-3">
                                            <LightbulbIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                            <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-tight">AI sẽ tự động đánh số thứ tự vào từng tư thế để bạn dễ gọi tên khi hướng dẫn.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || uploadedFiles.length === 0}
                            className="w-full py-5 px-6 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold rounded-3xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center shadow-2xl shadow-purple-500/30"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin mb-2"></div>
                                    <span className="text-lg tracking-wide">{statusMessage}</span>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 text-xl">
                                        <SparklesIcon className="w-7 h-7" />
                                        TẠO CẨM NANG CHIBI CƯỚI
                                    </div>
                                    <span className="text-xs font-normal opacity-80 mt-1 uppercase tracking-widest">Sẵn sàng phân tích {uploadedFiles.length} tư thế</span>
                                </>
                            )}
                        </button>
                        
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-2xl text-sm font-medium animate-shake flex gap-3 items-center">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <p className="font-bold">Lỗi xử lý</p>
                                    <p className="opacity-90">{error}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Result */}
                    <div className="sticky top-24 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-700 shadow-2xl">
                            <h3 className="text-lg font-bold text-center mb-6 text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
                                <span className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">✓</span>
                                Kết quả Bảng Hướng Dẫn
                            </h3>
                            
                            <div className={`relative flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden group shadow-inner ${selectedLayout.id === 'vertical' ? 'aspect-[3/4.5]' : 'aspect-[4/3]'}`}>
                                {isLoading && (
                                    <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md z-10 flex flex-col items-center justify-center">
                                        <Loader />
                                        <p className="mt-8 text-indigo-600 dark:text-indigo-400 font-bold animate-pulse text-sm px-6 text-center">{statusMessage}</p>
                                    </div>
                                )}
                                
                                {resultImage ? (
                                    <div className="relative w-full h-full p-3">
                                        <img src={resultImage} alt="Chibi Pose Guide Result" className="w-full h-full object-contain rounded-2xl shadow-sm bg-white" />
                                        <button 
                                            onClick={() => setZoomedImageUrl(resultImage)}
                                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 rounded-3xl backdrop-blur-[2px]"
                                        >
                                            <div className="bg-white/20 p-5 rounded-full border border-white/30 hover:scale-110 transition-transform">
                                                <ZoomInIcon className="w-12 h-12 text-white" />
                                            </div>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center p-12 space-y-5">
                                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto opacity-50 shadow-sm">
                                            <SparklesIcon className="w-12 h-12 text-slate-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold text-slate-500 text-lg">Đang chờ tư thế...</p>
                                            <p className="text-xs text-slate-400 max-w-[200px] mx-auto leading-relaxed">Sau khi tạo, bảng hướng dẫn sẽ xuất hiện tại đây để bạn tải về.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {resultImage && !isLoading && (
                                <div className="mt-8 space-y-4">
                                    <button
                                        onClick={handleUpscale}
                                        disabled={isUpscaling}
                                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-50"
                                    >
                                        {isUpscaling ? (
                                            <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <SparklesIcon className="w-6 h-6" />
                                        )}
                                        Nâng cấp 4K siêu nét
                                    </button>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={handleDownload}
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-500/20"
                                        >
                                            <DownloadIcon className="w-6 h-6" />
                                            Tải bảng về
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600"
                                        >
                                            Làm mới
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            {zoomedImageUrl && (
                <ZoomModal imageUrl={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} onDownload={handleDownload} />
            )}
            
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.4s ease-out forwards;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    75% { transform: translateX(8px); }
                }
                .animate-shake {
                    animation: shake 0.3s ease-in-out;
                }
            `}</style>
        </div>
    );
};
