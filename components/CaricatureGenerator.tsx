
import React, { useState, useMemo } from 'react';
import { PhotoUploader } from './PhotoUploader';
import { ComparisonSlider } from './ComparisonSlider';
import { Loader } from './Loader';
import { generateCaricature, upscaleImage } from '../services/geminiService';
import { dataUrlToFile } from '../utils/imageUtils';
import { SparklesIcon } from './icons/SparklesIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { OptionSelector } from './OptionSelector';
import { CheckIcon } from './icons/CheckIcon';
import { UpscaleIcon } from './icons/UpscaleIcon';
import type { Option } from '../types';

interface CaricatureStyle extends Option {
    description: string;
}

const STYLES: CaricatureStyle[] = [
    { id: '3D Pixar', name: '3D Hoạt hình (Pixar)', description: 'Phong cách 3D dễ thương, mắt to, da mịn như phim hoạt hình.' },
    { id: '2D Cartoon', name: 'Hoạt hình 2D', description: 'Nét vẽ đậm, màu sắc phẳng, vui nhộn kiểu cổ điển.' },
    { id: 'Pencil Sketch', name: 'Vẽ chì đường phố', description: 'Nét vẽ phác thảo đen trắng, nghệ thuật và bụi bặm.' },
    { id: 'Claymation', name: 'Đất sét (Clay)', description: 'Tạo hình như nhân vật làm từ đất sét, ngộ nghĩnh.' },
    { id: 'Funny Realism', name: 'Siêu thực hài hước', description: 'Giữ nguyên độ chân thực của da và tóc nhưng méo mó tỷ lệ.' },
    { 
        id: 'Biến bức ảnh này thành tranh biếm họa vui nhộn, nhấn mạnh một cách sáng tạo những đặc điểm nổi bật trên gương mặt (như mắt, mũi, miệng hoặc mái tóc) nhưng vẫn đảm bảo giữ được nét nhận diện và phong thái riêng của nhân vật. Sử dụng đường nét rõ ràng, độ bóng nhẹ và gam màu tươi sáng. Giữ nguyên dáng pose và trang phục gốc, đồng thời phóng đại nhẹ vóc dáng, chẳng hạn làm đầu lớn hơn và biểu cảm dí dỏm hơn. Phong cách nên gọn gàng, sinh động, dễ nhìn, mang hơi hướng của các tác phẩm biếm họa chuyên nghiệp. Nền có thể là trắng hoặc cách điệu, tùy theo bố cục tổng thể.', 
        name: 'Vui nhộn & Sáng tạo (Mới)', 
        description: 'Phong cách biếm họa chuyên nghiệp, đường nét rõ ràng, màu tươi sáng, biểu cảm dí dỏm.' 
    },
];

export const CaricatureGenerator: React.FC = () => {
    const [uploadedImage, setUploadedImage] = useState<File | null>(null);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
    const [selectedStyle, setSelectedStyle] = useState<CaricatureStyle>(STYLES[0]);
    const [customPrompt, setCustomPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadedImagePreview = useMemo(() => {
        if (!uploadedImage) return null;
        return URL.createObjectURL(uploadedImage);
    }, [uploadedImage]);

    const handleGenerate = async () => {
        if (!uploadedImage) {
            setError("Vui lòng tải ảnh lên trước.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        setSelectedImageIndex(0);

        try {
            const result = await generateCaricature(uploadedImage, selectedStyle.id, customPrompt);
            if (result.images && result.images.length > 0) {
                setGeneratedImages(result.images);
            } else {
                setError(result.text || 'Không thể tạo ảnh biếm họa. Yêu cầu của bạn có thể đã bị từ chối.');
            }
        } catch (e: unknown) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi không mong muốn.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpscale = async () => {
        if (generatedImages.length === 0) return;
        const currentImage = generatedImages[selectedImageIndex];
        setIsUpscaling(true);
        
        try {
            const file = await dataUrlToFile(currentImage, 'caricature.png');
            const result = await upscaleImage(file, 'portrait'); // Caricature is a type of portrait
            if (result.image) {
                const newImages = [...generatedImages];
                newImages[selectedImageIndex] = result.image;
                setGeneratedImages(newImages);
            } else {
                setError("Không thể nâng cấp ảnh này.");
            }
        } catch (e) {
            console.error("Upscale failed", e);
            setError("Lỗi khi nâng cấp ảnh.");
        } finally {
            setIsUpscaling(false);
        }
    };

    const handleDownload = () => {
        if (generatedImages.length === 0) return;
        const imageToDownload = generatedImages[selectedImageIndex];
        const a = document.createElement('a');
        a.href = imageToDownload;
        a.download = `caricature-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleReset = () => {
        setUploadedImage(null);
        setGeneratedImages([]);
        setSelectedImageIndex(0);
        setCustomPrompt('');
        setError(null);
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200">
            <main className="container mx-auto px-4 py-8 sm:py-12">
                <div className="text-center mb-8 sm:mb-10">
                    <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">Tạo Chân Dung Biếm Họa AI</h2>
                    <p className="mt-3 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                        Biến ảnh chân dung thành tác phẩm nghệ thuật hài hước, phóng đại nét đặc trưng và lột tả cá tính.
                    </p>
                </div>

                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-10 items-start">
                        {/* Left Column: Controls */}
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">1. Tải ảnh lên</h3>
                                <PhotoUploader onImageUpload={setUploadedImage} previewUrl={uploadedImagePreview} />
                            </div>

                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">2. Chọn phong cách</h3>
                                <OptionSelector<CaricatureStyle>
                                    label="Phong cách nghệ thuật"
                                    options={STYLES}
                                    selectedOption={selectedStyle}
                                    onSelect={setSelectedStyle}
                                    renderOption={(option) => (
                                        <div>
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{option.description}</p>
                                        </div>
                                    )}
                                />
                            </div>

                             <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-100">3. Yêu cầu thêm (Tùy chọn)</h3>
                                <textarea
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="Ví dụ: làm cho cái mũi to hơn nữa, thêm kính râm, biểu cảm ngạc nhiên..."
                                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 transition-all bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm"
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* Right Column: Result & Action */}
                        <div className="sticky top-24 space-y-4">
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-md">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 text-center">
                                    {generatedImages.length > 0 ? 'Kết quả' : 'Xem trước'}
                                </h3>
                                
                                {/* Main Preview Area */}
                                <div className="aspect-square w-full relative flex items-center justify-center bg-white dark:bg-slate-900/50 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 p-2 overflow-hidden mb-4">
                                    {isLoading && <Loader />}
                                    
                                    {!isLoading && generatedImages.length === 0 && !uploadedImage && (
                                         <div className="text-center text-slate-400 dark:text-slate-500 pointer-events-none select-none">
                                            <SparklesIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>Tải ảnh lên và nhấn tạo để xem phép màu</p>
                                        </div>
                                    )}

                                    {!isLoading && uploadedImage && generatedImages.length === 0 && (
                                         <img src={uploadedImagePreview || ''} alt="Preview" className="object-contain w-full h-full rounded-md opacity-50" />
                                    )}

                                    {generatedImages.length > 0 && uploadedImagePreview && (
                                        <div className="w-full h-full">
                                             <ComparisonSlider 
                                                originalImageUrl={uploadedImagePreview} 
                                                generatedImageUrl={generatedImages[selectedImageIndex]} 
                                             />
                                        </div>
                                    )}
                                </div>

                                {/* Thumbnails for Variations */}
                                {generatedImages.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Các biến thể (4):</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {generatedImages.map((img, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedImageIndex(idx)}
                                                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                                        selectedImageIndex === idx 
                                                            ? 'border-purple-600 ring-2 ring-purple-200 dark:ring-purple-900' 
                                                            : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                                                    }`}
                                                >
                                                    <img src={img} alt={`Variation ${idx + 1}`} className="w-full h-full object-cover" />
                                                    {selectedImageIndex === idx && (
                                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                                            <div className="bg-purple-600 rounded-full p-1">
                                                                <CheckIcon className="w-3 h-3 text-white" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {generatedImages.length > 0 ? (
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleUpscale}
                                            disabled={isUpscaling}
                                            className="w-full bg-amber-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-amber-600 transition-colors shadow flex items-center justify-center gap-2"
                                        >
                                            {isUpscaling ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                                    Đang nâng cấp...
                                                </>
                                            ) : (
                                                <>
                                                    <UpscaleIcon className="w-5 h-5" />
                                                    Nâng cấp 4K (Ảnh đang chọn)
                                                </>
                                            )}
                                        </button>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={handleDownload}
                                                className="flex items-center justify-center w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors shadow"
                                            >
                                                <DownloadIcon className="w-5 h-5 mr-2" />
                                                Tải xuống
                                            </button>
                                            <button
                                                onClick={handleReset}
                                                className="w-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-100 font-bold py-3 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                                            >
                                                Tạo mới
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleGenerate}
                                            disabled={isLoading}
                                            className="w-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold py-2 px-4 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm"
                                        >
                                            {isLoading ? 'Đang tạo lại...' : 'Tạo lại 4 ảnh khác'}
                                        </button>
                                    </div>
                                ) : null}

                                {error && (
                                    <div className="mt-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-500/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm text-center" role="alert">
                                        <p className="font-bold">Đã xảy ra lỗi</p>
                                        <p>{error}</p>
                                    </div>
                                )}
                            </div>

                            {/* Initial Generate Button */}
                            {generatedImages.length === 0 && (
                                <button
                                    onClick={handleGenerate}
                                    disabled={!uploadedImage || isLoading}
                                    className="w-full py-4 px-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-300 dark:disabled:bg-purple-800/50 disabled:cursor-not-allowed flex items-center justify-center text-lg shadow-lg shadow-purple-500/30"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin mr-3"></div>
                                            Đang vẽ biếm họa...
                                        </>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-6 h-6 mr-2" />
                                            Tạo Tranh Biếm Họa
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
