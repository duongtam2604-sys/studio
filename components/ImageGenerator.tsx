
import React, { useState, useCallback } from 'react';
import { generateImageFromPrompt, upscaleImage } from '../services/geminiService';
import { dataUrlToFile } from '../utils/imageUtils';
import { Quality } from './pro-ai-relight/types';
import { Loader } from './Loader';
import { CheckIcon } from './icons/CheckIcon';
import { UpscaleIcon } from './icons/UpscaleIcon';

// A simple button group component for quality selection
const Button: React.FC<{ onClick: () => void; isActive: boolean; children: React.ReactNode }> = ({ onClick, isActive, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
      isActive
        ? 'bg-blue-600 text-white shadow'
        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
    }`}
  >
    {children}
  </button>
);

const presets = [
    { name: 'Tuyết rơi', prompt: 'Khung cảnh tuyết rơi chân thực với độ phân giải cao, các bông tuyết có kích thước đa dạng để tạo cảm giác tự nhiên và chiều sâu. Hiệu ứng tán xạ ánh sáng mềm mại, ánh sáng điện ảnh làm tăng độ chân thực. Tách biệt hoàn toàn trên nền đen để dễ ghép trong hậu kỳ.' },
    { name: 'Bong bóng', prompt: 'A dense cluster of shimmering soap bubbles, various sizes from tiny to large, gently scattered and evenly spaced, with minimal overlapping, creating depth and clarity. Photorealistic, translucent with iridescent rainbow highlights, floating gently against a solid black background for easy compositing.' },
    { name: 'Mưa rơi', prompt: 'Realistic falling rain streaks, high-resolution, slight motion blur, on a black background for compositing.' },
    { name: 'Hiệu ứng bokeh vàng', prompt: 'Một cụm hiệu ứng bokeh vàng rực rỡ, ánh sáng mờ ảo, nhiều kích thước khác nhau để tạo độ sâu. Phong cách điện ảnh, siêu chân thực, hiệu ứng lấp lánh dải động cao (HDR shimmer). Nổi bật trên nền đen trơn để dễ dàng compositing.' },
    { name: 'Tia nắng kịch tính', prompt: 'Một khung cảnh các tia nắng mạnh mẽ với hiệu ứng ánh sáng thể tích (volumetric light beams), tỏa xuống không gian trong sắc vàng của giờ hoàng hôn. Siêu chi tiết, chân thực, ánh sáng xuyên qua lớp sương mờ tạo chiều sâu. Nền đen tinh khiết, tách biệt hoàn toàn để dễ dàng ghép vào hậu kỳ.' },
    { name: 'Khói ma mị', prompt: 'Wispy, ethereal smoke tendrils, mystical, white and grey smoke, on a black background for easy blending.' },
    { name: 'ID Sinh viên', prompt: 'Ảnh thẻ chân dung studio của một sinh viên Việt Nam ngẫu nhiên, độ tuổi 18-26, giới tính ngẫu nhiên. Tóc tai gọn gàng, mặc áo sơ mi trắng hoặc xanh. Khuôn mặt nhìn thẳng, biểu cảm trung tính. Phông nền màu xanh nhạt. Ánh sáng chuyên nghiệp, ảnh chất lượng cao, siêu thực.' },
];

const aspectRatios = [
    { id: '1:1', name: 'Vuông' },
    { id: '16:9', name: 'Ngang (Cinematic)' },
    { id: '9:16', name: 'Dọc' },
    { id: '4:3', name: 'Ngang (4:3)' },
    { id: '3:4', name: 'Dọc (3:4)' },
];

export const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [quality, setQuality] = useState<Quality>('standard');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [generatedImages, setGeneratedImages] = useState<string[] | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpscaling, setIsUpscaling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Vui lòng nhập yêu cầu để tạo ảnh.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImages(null);
    setSelectedImage(null);

    try {
      const result = await generateImageFromPrompt(prompt, aspectRatio);
      if (result.images && result.images.length > 0) {
        setGeneratedImages(result.images);
      } else {
        setError(result.text || 'Không thể tạo ảnh. Yêu cầu của bạn có thể đã bị AI từ chối.');
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi không mong muốn.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpscale = async () => {
      if (!selectedImage || !generatedImages) return;
      setIsUpscaling(true);
      
      try {
          const file = await dataUrlToFile(selectedImage, 'generated_image.png');
          const result = await upscaleImage(file, 'general');
          
          if (result.image) {
              // Update the selected image in the list
              const updatedImages = generatedImages.map(img => img === selectedImage ? result.image! : img);
              setGeneratedImages(updatedImages);
              setSelectedImage(result.image); // Keep selection
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

  const handleDownload = useCallback(() => {
    if (!selectedImage) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = selectedImage;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let finalWidth = image.naturalWidth;
      let finalHeight = image.naturalHeight;

      if (quality === '2k' && image.naturalWidth < 2048) {
          finalWidth = 2048;
          finalHeight = image.naturalHeight * (2048 / image.naturalWidth);
      } else if (quality === '4k' && image.naturalWidth < 4096) {
          // If real upscale was used, width is likely already large. 
          // If not, we scale canvas.
          finalWidth = 4096;
          finalHeight = image.naturalHeight * (4096 / image.naturalWidth);
      }
      
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-generated-image-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
      }, 'image/png');
    };
  }, [selectedImage, quality]);

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200">
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">Tạo Ảnh AI Từ Văn Bản</h2>
            <p className="mt-3 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Biến ý tưởng của bạn thành hình ảnh độc đáo chỉ với vài từ mô tả.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Controls */}
            <div className="space-y-6 bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-transparent dark:border-slate-700 shadow-lg">
              <div>
                 <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
                    Gợi ý nhanh
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                    {presets.map((p) => (
                    <button
                        key={p.name}
                        onClick={() => setPrompt(p.prompt)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                        {p.name}
                    </button>
                    ))}
                </div>

                <label htmlFor="image-prompt" className="block text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  Nhập yêu cầu của bạn
                </label>
                <textarea
                  id="image-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ví dụ: một chú mèo phi hành gia đang cưỡi ngựa trên sao hỏa, phong cách nghệ thuật số..."
                  className="w-full h-36 p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-base"
                  rows={4}
                />
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Tỷ lệ khung hình</h3>
                 <div className="flex flex-wrap gap-2">
                    {aspectRatios.map((ratio) => (
                        <button
                            key={ratio.id}
                            onClick={() => setAspectRatio(ratio.id)}
                             className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                aspectRatio === ratio.id
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                            }`}
                        >
                            {ratio.name} ({ratio.id})
                        </button>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Kích thước tải xuống</h3>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                  <Button onClick={() => setQuality('standard')} isActive={quality === 'standard'}>Tiêu chuẩn</Button>
                  <Button onClick={() => setQuality('2k')} isActive={quality === '2k'}>2K</Button>
                  <Button onClick={() => setQuality('4k')} isActive={quality === '4k'}>4K</Button>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className="w-full py-3 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center text-lg shadow-lg shadow-blue-500/30"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin mr-3"></div>
                    Đang tạo...
                  </>
                ) : 'Tạo Ảnh'}
              </button>
            </div>

            {/* Image Display */}
            <div className="sticky top-24">
              <div className="aspect-square relative flex items-center justify-center bg-white dark:bg-slate-800/50 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-2">
                {isLoading && <Loader />}
                
                {generatedImages && !isLoading && (
                  <div className="grid grid-cols-2 gap-2 w-full h-full">
                    {generatedImages.map((imgSrc, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(imgSrc)}
                        className={`relative rounded-lg overflow-hidden focus:outline-none transition-all duration-200 ${
                          selectedImage === imgSrc
                            ? 'ring-4 ring-blue-500'
                            : 'ring-2 ring-transparent hover:ring-blue-400'
                        }`}
                      >
                        <img src={imgSrc} alt={`AI generated variant ${index + 1}`} className="w-full h-full object-cover" />
                        {selectedImage === imgSrc && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <CheckIcon className="h-8 w-8 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                
                {!generatedImages && !isLoading && (
                  <div className="text-center text-slate-500 dark:text-slate-400 p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300 dark:text-slate-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-4 text-base font-semibold">4 biến thể ảnh sẽ hiện ở đây</p>
                  </div>
                )}
              </div>
              
              {generatedImages && !isLoading && (
                <div className='space-y-3 mt-4'>
                    <button
                        onClick={handleUpscale}
                        disabled={!selectedImage || isUpscaling}
                        className="w-full bg-amber-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-amber-600 transition-colors text-base shadow-lg disabled:bg-amber-300 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isUpscaling ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2"></div>
                                Đang nâng cấp...
                            </>
                        ) : (
                            <>
                                <UpscaleIcon className="w-5 h-5 mr-2" />
                                Nâng cấp 4K (Ảnh đang chọn)
                            </>
                        )}
                    </button>
                    
                    <button
                        onClick={handleDownload}
                        disabled={!selectedImage || isUpscaling}
                        className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors text-base shadow-lg shadow-green-500/30 disabled:bg-green-400 dark:disabled:bg-green-800/50 disabled:cursor-not-allowed"
                    >
                        {selectedImage ? 'Tải ảnh đã chọn (PNG)' : 'Chọn một ảnh để tải xuống'}
                    </button>
                </div>
              )}

              {error && (
                <div className="mt-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-500/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                  <p className="font-bold">Đã xảy ra lỗi</p>
                  <p>{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
