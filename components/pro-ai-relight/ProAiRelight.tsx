
import React, { useState, useMemo, useCallback } from 'react';
import { ControlPanel } from './ControlPanel';
import { ImageDisplay } from './ImageDisplay';
import { relightImage, upscaleImage } from '../../services/geminiService';
import { dataUrlToFile } from '../../utils/imageUtils';
import type { RelightSettings, Language } from './types';
import { locales } from './locales';

export const ProAiRelight: React.FC = () => {
  const [language, setLanguage] = useState<Language>('vi');
  const t = useMemo(() => locales[language], [language]);

  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [relightSettings, setRelightSettings] = useState<RelightSettings>({
    backlightDirection: 'middle',
    lightType: 'natural',
    lightColor1: 'Red',
    lightColor2: 'Blue',
    lightColor3: 'Purple',
    quality: 'standard',
    customPrompt: '',
  });

  const handleImageUpload = useCallback((file: File) => {
    setUploadedImage(file);
    setUploadedImagePreview(URL.createObjectURL(file));
    setGeneratedImage(null);
    setError(null);
  }, []);

  const handleRelight = async () => {
    if (!uploadedImage) return;

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    const messages = t.loadingMessages;
    let messageIndex = 0;
    setLoadingMessage(messages[messageIndex]);
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setLoadingMessage(messages[messageIndex]);
    }, 2500);

    try {
      const result = await relightImage(uploadedImage, relightSettings);
      let finalImage = result.image;

      // Auto-upscale if quality is set to 4K
      if (finalImage && relightSettings.quality === '4k') {
          setLoadingMessage(language === 'vi' ? 'Đang nâng cấp lên 4K Ultra HD...' : 'Upscaling to 4K Ultra HD...');
          const file = await dataUrlToFile(finalImage, 'relit_image.png');
          const upscaleResult = await upscaleImage(file, 'general');
          if (upscaleResult.image) {
              finalImage = upscaleResult.image;
          }
      }

      if (finalImage) {
        setGeneratedImage(finalImage);
      } else {
        setError(result.text || t.error.generationFailed);
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : t.error.unexpected);
    } finally {
      setIsLoading(false);
      clearInterval(interval);
    }
  };

  const handleDownload = useCallback(() => {
    if (!generatedImage) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = generatedImage;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let finalWidth = image.naturalWidth;
      let finalHeight = image.naturalHeight;

      // Only force canvas size if we didn't already get a 4K image from upscaler
      // But since upscaler returns real high res, we should respect natural dims mostly
      // Just handle 2k constraint if selected
      if (relightSettings.quality === '2k' && image.naturalWidth < 2048) {
          finalWidth = 2048;
          finalHeight = image.naturalHeight * (2048 / image.naturalWidth);
      } 
      
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pro-ai-relight-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
      }, 'image/png');
    };
  }, [generatedImage, relightSettings.quality]);

  return (
    <div className="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-screen">
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="grid gap-8 transition-all duration-500 lg:grid-cols-[350px_1fr]">
          
          {/* Column 1: Control Panel */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <ControlPanel
              settings={relightSettings}
              setSettings={setRelightSettings}
              onImageUpload={handleImageUpload}
              onRelight={handleRelight}
              isRelighting={isLoading}
              hasUploadedImage={!!uploadedImage}
              language={language}
              setLanguage={setLanguage}
              t={t.controls}
            />
          </div>

          {/* Column 2: Image Display */}
          <div className="min-w-0">
             <ImageDisplay
                originalImage={uploadedImagePreview}
                generatedImage={generatedImage}
                isLoading={isLoading}
                loadingMessage={loadingMessage}
                onDownload={handleDownload}
                t={t.imageDisplay}
            />
             {error && (
                <div className="mt-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-500/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <p className="font-bold">{t.error.title}</p>
                    <p>{error}</p>
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
