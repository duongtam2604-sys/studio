
import React, { useState, useMemo, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { PhotoUploader } from './PhotoUploader';
import { OptionSelector } from './OptionSelector';
import { ResultView } from './ResultView';
import { Loader } from './Loader';
import { BACKGROUNDS, OUTFITS, GENDERS, HAIRSTYLES, ASPECT_RATIOS, RETOUCH_OPTIONS, COUNTRY_TEMPLATES, DOCUMENT_TYPES, LIGHTING_OPTIONS, EXPRESSION_OPTIONS } from '../constants';
import type { Background, Outfit, GenderOption, Hairstyle, AspectRatio, RetouchOption, CountryTemplate, ImageAnalysisResult, DocumentType, LightingOption, ExpressionOption } from '../types';
import { generateIdPhoto, analyzeImage, upscaleImage } from '../services/geminiService';
import { dataUrlToFile } from '../utils/imageUtils';
import { ImageAnalysisFeedback } from './ImageAnalysisFeedback';
import { GlobeIcon } from './icons/GlobeIcon';
import { TabbedControls } from './TabbedControls';
import { ZoomModal } from './ZoomModal';
import { SparklesIcon } from './icons/SparklesIcon';
import { CheckIcon } from './icons/CheckIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface BatchImage {
    id: string;
    file: File;
    previewUrl: string;
    status: 'idle' | 'processing' | 'done' | 'error';
    resultUrl?: string;
    error?: string;
}

export const IdPhotoGenerator: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Batch Mode State
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [batchImages, setBatchImages] = useState<BatchImage[]>([]);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const stopBatchRef = useRef<boolean>(false);

  // Controls State
  const [selectedCountryTemplate, setSelectedCountryTemplate] = useState<CountryTemplate>(COUNTRY_TEMPLATES[0]);
  const [selectedBackground, setSelectedBackground] = useState<Background>(BACKGROUNDS[0]);
  const [selectedGender, setSelectedGender] = useState<GenderOption>(GENDERS[0]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType>(DOCUMENT_TYPES[0]);
  const [selectedLighting, setSelectedLighting] = useState<LightingOption>(LIGHTING_OPTIONS[0]);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>(ASPECT_RATIOS[0]);
  const [selectedRetouch, setSelectedRetouch] = useState<RetouchOption>(RETOUCH_OPTIONS[1]);
  const [selectedExpression, setSelectedExpression] = useState<ExpressionOption>(EXPRESSION_OPTIONS[0]);
  const [allowAiCreativity, setAllowAiCreativity] = useState<boolean>(false);
  const [strictPreservation, setStrictPreservation] = useState<boolean>(false);
  const [isUltraHD, setIsUltraHD] = useState<boolean>(true); // Default to true for high quality
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [customBackgroundColor, setCustomBackgroundColor] = useState<string>('#4a90e2');

  // Custom Outfit State
  const [customOutfitFile, setCustomOutfitFile] = useState<File | null>(null);
  const [customOutfitPreview, setCustomOutfitPreview] = useState<string | null>(null);
  const customOutfitInputRef = useRef<HTMLInputElement>(null);

  // Image Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);

  // Zoom Modal State
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  
  // Memoized values for dynamic options and previews
  const filteredOutfits = useMemo(() => {
    const genderFiltered = OUTFITS.filter(outfit => !outfit.gender || outfit.gender === selectedGender.name || outfit.id === 'custom');
    
    if (selectedDocumentType.id === 'all') {
      return genderFiltered.map(o => ({ ...o, isRecommended: false }));
    }

    const recommended = genderFiltered
      .filter(o => o.documentTypes?.includes(selectedDocumentType.id))
      .map(o => ({ ...o, isRecommended: true }));
    
    const others = genderFiltered
      .filter(o => !o.documentTypes?.includes(selectedDocumentType.id))
      .map(o => ({ ...o, isRecommended: false }));
      
    return [...recommended, ...others];
  }, [selectedGender, selectedDocumentType]);
  
  const filteredHairstyles = useMemo(() => HAIRSTYLES.filter(style => !style.gender || style.gender === selectedGender.name), [selectedGender]);
  
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit>(filteredOutfits[0]);
  const [selectedHairstyle, setSelectedHairstyle] = useState<Hairstyle>(filteredHairstyles[0]);
  
  const uploadedImagePreview = useMemo(() => {
    if (!uploadedImage) return null;
    return URL.createObjectURL(uploadedImage);
  }, [uploadedImage]);

  // Effect for Country Template Selection
  useEffect(() => {
    if (selectedCountryTemplate.id === 'custom') return;

    const templateBg = BACKGROUNDS.find(b => b.id === selectedCountryTemplate.backgroundId);
    const templateAr = ASPECT_RATIOS.find(a => a.id === selectedCountryTemplate.aspectRatioId);

    if (templateBg) setSelectedBackground(templateBg);
    if (templateAr) setSelectedAspectRatio(templateAr);

  }, [selectedCountryTemplate]);

  // Effect for Gender or Document Type Change
  useEffect(() => {
    const updatedSelectedOutfit = filteredOutfits.find(o => o.id === selectedOutfit.id);

    if (updatedSelectedOutfit) {
        setSelectedOutfit(updatedSelectedOutfit);
    } else if (filteredOutfits.length > 0) {
        setSelectedOutfit(filteredOutfits.find(o => o.isRecommended) || filteredOutfits[0]);
    }
    
    const isCurrentHairstyleValid = filteredHairstyles.some(h => h.id === selectedHairstyle.id);
    if (!isCurrentHairstyleValid && filteredHairstyles.length > 0) {
      setSelectedOutfit(filteredOutfits.find(o => o.id === 'none') || filteredOutfits[0]);
    }
  }, [selectedGender, selectedDocumentType]);

  // Effect to sync selected outfit when filtered outfits change
  useEffect(() => {
    const updatedOutfit = filteredOutfits.find(o => o.id === selectedOutfit.id);
    if (updatedOutfit) {
        setSelectedOutfit(updatedOutfit);
    }
  }, [filteredOutfits, selectedOutfit.id]);

  // Effect for strict preservation mode
  useEffect(() => {
    if (strictPreservation) {
      setAllowAiCreativity(false);
      const defaultHairstyle = filteredHairstyles.find(h => h.id === 'none');
      if (defaultHairstyle) setSelectedHairstyle(defaultHairstyle);
      
      const gentleRetouch = RETOUCH_OPTIONS.find(r => r.id === 'none');
      if (gentleRetouch) setSelectedRetouch(gentleRetouch);
    }
  }, [strictPreservation, filteredHairstyles]);


  // Effect for Image Upload and Analysis
  useEffect(() => {
    if (!uploadedImage) {
        setAnalysisResult(null);
        return;
    }
    const performAnalysis = async () => {
        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const result = await analyzeImage(uploadedImage);
            setAnalysisResult(result);
            if (result.gender) {
                const detectedGender = GENDERS.find(g => g.name === result.gender);
                if (detectedGender) {
                    setSelectedGender(detectedGender);
                }
            }
        } catch (e) {
            console.error("Image analysis failed:", e);
        } finally {
            setIsAnalyzing(false);
        }
    };
    performAnalysis();
  }, [uploadedImage]);

  const handleCustomOutfitUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCustomOutfitFile(file);
      const previewUrl = URL.createObjectURL(file);
      setCustomOutfitPreview(previewUrl);
      
      const customOutfitOption = OUTFITS.find(o => o.id === 'custom');
      if (customOutfitOption) {
        setSelectedOutfit(customOutfitOption);
      }
    }
    if(event.target) {
        event.target.value = '';
    }
  };

  const handleOutfitSelect = (outfit: Outfit) => {
    if (outfit.id === 'custom') {
      customOutfitInputRef.current?.click();
    }
    setSelectedOutfit(outfit);
  };

  const handleBatchFilesUpload = (files: File[]) => {
      const newBatchImages: BatchImage[] = files.map(file => ({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'idle'
      }));
      setBatchImages(prev => [...prev, ...newBatchImages]);
  };

  const handleRemoveBatchImage = (id: string) => {
      setBatchImages(prev => prev.filter(img => img.id !== id));
  };

  const handleGenerateClick = async () => {
    if (isBatchMode) {
        await handleBatchGenerate();
    } else {
        await handleSingleGenerate();
    }
  };

  const handleSingleGenerate = async () => {
    if (!uploadedImage) {
      setError('Vui lòng tải ảnh lên trước.');
      return;
    }

    setIsLoading(true);
    setError(null);
    if (!customPrompt) {
        setGeneratedImage(null);
    }
    
    const backgroundColor = selectedBackground.id === 'custom-color' 
        ? customBackgroundColor 
        : selectedBackground.name;
    
    const outfitSelection = {
        name: selectedOutfit.name,
        file: selectedOutfit.id === 'custom' ? customOutfitFile : null,
    };

    try {
      // Step 1: Generate initial ID photo
      const result = await generateIdPhoto(
        uploadedImage,
        backgroundColor,
        outfitSelection,
        selectedGender.name,
        selectedHairstyle.name,
        selectedAspectRatio.name,
        selectedRetouch.name,
        selectedLighting.name,
        selectedExpression.name,
        allowAiCreativity,
        strictPreservation,
        customPrompt
      );

      let finalImage = result.image;

      // Step 2: Auto-Upscale if requested and generation was successful
      if (finalImage && isUltraHD) {
          const file = await dataUrlToFile(finalImage, 'generated_id_photo.png');
          const upscaleResult = await upscaleImage(file, 'portrait');
          if (upscaleResult.image) {
              finalImage = upscaleResult.image;
          }
      }

      if (finalImage) {
        setGeneratedImage(finalImage);
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

  const handleBatchGenerate = async () => {
      const pendingImages = batchImages.filter(img => img.status === 'idle' || img.status === 'error');
      if (pendingImages.length === 0) {
          setError('Không có ảnh nào cần xử lý.');
          return;
      }

      setIsLoading(true);
      stopBatchRef.current = false;
      setBatchProgress(0);
      
      const backgroundColor = selectedBackground.id === 'custom-color' 
        ? customBackgroundColor 
        : selectedBackground.name;
    
      const outfitSelection = {
        name: selectedOutfit.name,
        file: selectedOutfit.id === 'custom' ? customOutfitFile : null,
      };

      let processedCount = 0;
      const totalToProcess = pendingImages.length;

      for (const imageTask of batchImages) {
          if (stopBatchRef.current) break;
          if (imageTask.status === 'done') continue;

          // Update status to processing
          setBatchImages(prev => prev.map(img => img.id === imageTask.id ? { ...img, status: 'processing', error: undefined } : img));

          try {
              const result = await generateIdPhoto(
                imageTask.file,
                backgroundColor,
                outfitSelection,
                selectedGender.name,
                selectedHairstyle.name,
                selectedAspectRatio.name,
                selectedRetouch.name,
                selectedLighting.name,
                selectedExpression.name,
                allowAiCreativity,
                strictPreservation,
                customPrompt
              );

              let finalImage = result.image;

              if (finalImage && isUltraHD) {
                  const file = await dataUrlToFile(finalImage, 'temp.png');
                  const upscaleResult = await upscaleImage(file, 'portrait');
                  if (upscaleResult.image) finalImage = upscaleResult.image;
              }

              if (finalImage) {
                  setBatchImages(prev => prev.map(img => img.id === imageTask.id ? { ...img, status: 'done', resultUrl: finalImage! } : img));
              } else {
                  setBatchImages(prev => prev.map(img => img.id === imageTask.id ? { ...img, status: 'error', error: 'AI từ chối' } : img));
              }

          } catch (e) {
              console.error(e);
              setBatchImages(prev => prev.map(img => img.id === imageTask.id ? { ...img, status: 'error', error: 'Lỗi' } : img));
          }

          processedCount++;
          setBatchProgress((processedCount / totalToProcess) * 100);
      }

      setIsLoading(false);
  };

  const handleStopBatch = () => {
      stopBatchRef.current = true;
      setIsLoading(false);
  };

  const handleBatchDownloadZip = async () => {
      const completedImages = batchImages.filter(img => img.status === 'done' && img.resultUrl);
      if (completedImages.length === 0) return;

      const zip = new JSZip();
      const folder = zip.folder("anh-the-ai");

      for (let i = 0; i < completedImages.length; i++) {
          const img = completedImages[i];
          if (img.resultUrl) {
              const response = await fetch(img.resultUrl);
              const blob = await response.blob();
              // Clean filename
              const originalName = img.file.name.substring(0, img.file.name.lastIndexOf('.')) || 'image';
              folder?.file(`${originalName}_id_photo.png`, blob);
          }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = "anh-the-batch.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleReset = () => {
    setUploadedImage(null);
    setGeneratedImage(null);
    setError(null);
    setIsLoading(false);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setSelectedCountryTemplate(COUNTRY_TEMPLATES[0]);
    setSelectedBackground(BACKGROUNDS[0]);
    setSelectedGender(GENDERS[0]);
    setSelectedDocumentType(DOCUMENT_TYPES[0]);
    setSelectedLighting(LIGHTING_OPTIONS[0]);
    const defaultOutfit = OUTFITS.find(o => o.id === 'none') || OUTFITS[0];
    setSelectedOutfit(defaultOutfit);
    setSelectedHairstyle(HAIRSTYLES[0]);
    setSelectedAspectRatio(ASPECT_RATIOS[0]);
    setSelectedRetouch(RETOUCH_OPTIONS[1]);
    setSelectedExpression(EXPRESSION_OPTIONS[0]);
    setAllowAiCreativity(false);
    setStrictPreservation(false);
    setIsUltraHD(true);
    setCustomPrompt('');
    setCustomOutfitFile(null);
    setCustomOutfitPreview(null);
    
    // Batch reset
    setBatchImages([]);
    setBatchProgress(0);
  };

  const handleDownload = (format: 'jpeg' | 'png') => {
    if (!generatedImage) return;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = generatedImage;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        
        const mimeType = `image/${format}`;
        const fileExtension = format === 'jpeg' ? 'jpg' : 'png';
        
        const imageUrl = canvas.toDataURL(mimeType, 1.0);
        
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `ai-id-photo.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };
  };

  const handleZoomDownload = () => {
      if (!zoomedImageUrl) return;

      let filename = 'ai-id-photo.png';
      if (isBatchMode) {
          const batchItem = batchImages.find(img => img.resultUrl === zoomedImageUrl || img.previewUrl === zoomedImageUrl);
          if (batchItem) {
              const originalName = batchItem.file.name.split('.')[0];
              filename = `${originalName}_processed.png`;
          }
      }

      const a = document.createElement('a');
      a.href = zoomedImageUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const isGenerateDisabled = (!uploadedImage && !isBatchMode) || (isBatchMode && batchImages.length === 0) || isLoading || isAnalyzing;
  
  const tabContent = {
    'Phông nền & kích thước': (
        <>
            <OptionSelector<Background>
              label="Màu nền"
              options={BACKGROUNDS}
              selectedOption={selectedBackground}
              onSelect={setSelectedBackground}
              disabled={selectedCountryTemplate.id !== 'custom'}
              renderOption={(option) => (
                <div className="flex items-center">
                  {option.id === 'custom-color' ? (
                    <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 mr-3" style={{ backgroundColor: customBackgroundColor }}></div>
                  ) : (
                    <div className={`w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 ${option.tailwindColor} mr-3`}></div>
                  )}
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>
                </div>
              )}
            />
            {selectedBackground.id === 'custom-color' && selectedCountryTemplate.id === 'custom' && (
              <div className="mt-3 flex items-center gap-3">
                  <label htmlFor="custom-bg-color" className="text-sm font-medium text-slate-700 dark:text-slate-300">Màu tùy chọn:</label>
                  <div className="relative w-8 h-8 rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden shadow-inner">
                      <div className="absolute inset-0" style={{ backgroundColor: customBackgroundColor }}></div>
                      <input
                      type="color"
                      id="custom-bg-color"
                      value={customBackgroundColor}
                      onChange={(e) => setCustomBackgroundColor(e.target.value)}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                      aria-label="Chọn màu nền tùy chỉnh"
                      />
                  </div>
                  <span className="font-mono text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md">{customBackgroundColor.toUpperCase()}</span>
              </div>
            )}
            <OptionSelector<AspectRatio>
              label="Tỷ lệ ảnh"
              options={ASPECT_RATIOS}
              selectedOption={selectedAspectRatio}
              onSelect={setSelectedAspectRatio}
              disabled={selectedCountryTemplate.id !== 'custom'}
              renderOption={(option) => <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>}
            />
        </>
    ),
    'Trang phục & kiểu tóc': (
        <>
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                <label htmlFor="strict-preservation-toggle" className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 cursor-pointer select-none">
                    <CheckIcon className="w-5 h-5 text-blue-600"/>
                    Giữ nguyên 100% khuôn mặt
                    <span className="tooltip-container" data-tooltip="Bật chế độ này để đảm bảo AI không thay đổi bất kỳ chi tiết nào trên khuôn mặt. Chỉ thay nền và trang phục.">
                        (?)
                    </span>
                </label>
                <div 
                    className="relative inline-flex items-center cursor-pointer"
                    onClick={() => setStrictPreservation(!strictPreservation)}
                >
                    <input 
                        type="checkbox" 
                        id="strict-preservation-toggle" 
                        className="sr-only peer" 
                        checked={strictPreservation} 
                        readOnly
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
            </div>

            <OptionSelector<GenderOption>
              label="Giới tính"
              options={GENDERS}
              selectedOption={selectedGender}
              onSelect={setSelectedGender}
              renderOption={(option) => <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>}
            />
            <OptionSelector<DocumentType>
              label="Loại giấy tờ (để gợi ý trang phục)"
              options={DOCUMENT_TYPES}
              selectedOption={selectedDocumentType}
              onSelect={setSelectedDocumentType}
              renderOption={(option) => <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>}
            />
            <OptionSelector<Outfit>
              label="Trang phục"
              options={filteredOutfits}
              selectedOption={selectedOutfit}
              onSelect={handleOutfitSelect}
              renderOption={(option) => {
                const isCustom = option.id === 'custom';
                const previewUrl = isCustom && customOutfitPreview ? customOutfitPreview : option.previewUrl;
                return (
                    <div className="flex items-center">
                      <img src={previewUrl} alt={option.name} className={`w-8 h-8 rounded-md object-cover mr-3 ${isCustom && customOutfitPreview ? 'bg-slate-200 dark:bg-slate-700' : ''}`} />
                      <div className='flex-grow'>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>
                      </div>
                      {option.isRecommended && <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 font-semibold px-2 py-0.5 rounded-full">Gợi ý</span>}
                    </div>
                );
              }}
            />
            <div className={strictPreservation ? 'opacity-50 pointer-events-none' : ''}>
                <OptionSelector<Hairstyle>
                label="Kiểu tóc"
                options={filteredHairstyles}
                selectedOption={selectedHairstyle}
                onSelect={setSelectedHairstyle}
                renderOption={(option) => (
                    <div className="flex items-center">
                    <img src={option.previewUrl} alt={option.name} className="w-8 h-8 rounded-md object-cover mr-3" />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>
                    </div>
                )}
                />
                {strictPreservation && <p className="text-xs text-blue-600 mt-1">*Kiểu tóc được giữ nguyên khi bật chế độ 100%.</p>}
            </div>
        </>
    ),
    'Chỉnh sửa da & ánh sáng': (
        <>
            <OptionSelector<LightingOption>
                label="Chỉnh sửa ánh sáng"
                options={LIGHTING_OPTIONS}
                selectedOption={selectedLighting}
                onSelect={setSelectedLighting}
                renderOption={(option) => (
                    <div>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>
                    {option.id === 'on' && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pr-5">Tự động cân bằng ánh sáng, xóa bóng gắt trên mặt.</p>}
                </div>
                )}
            />
            <div className={strictPreservation ? 'opacity-50 pointer-events-none' : ''}>
                <OptionSelector<RetouchOption>
                    label="Chỉnh sửa da"
                    options={RETOUCH_OPTIONS}
                    selectedOption={selectedRetouch}
                    onSelect={setSelectedRetouch}
                    renderOption={(option) => (
                    <div>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pr-5">{option.description}</p>
                    </div>
                    )}
                />
            </div>
            <OptionSelector<ExpressionOption>
                label="Điều chỉnh biểu cảm"
                options={EXPRESSION_OPTIONS}
                selectedOption={selectedExpression}
                onSelect={setSelectedExpression}
                renderOption={(option) => (
                <div>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pr-5">{option.description}</p>
                </div>
                )}
            />
            <div className={`flex items-center justify-between bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg mt-4 ${strictPreservation ? 'opacity-50 pointer-events-none' : ''}`}>
                <label htmlFor="ai-creativity-toggle" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                    <SparklesIcon className="w-5 h-5 text-purple-500"/>
                    Cho phép AI sáng tạo
                    <span className="tooltip-container" data-tooltip="Bật tính năng này để AI tinh chỉnh nhẹ khuôn mặt, giúp ảnh đẹp hơn nhưng vẫn giữ 90% nét gốc. Tắt để giữ nguyên 100% khuôn mặt.">
                        (?)
                    </span>
                </label>
                <div 
                    className="relative inline-flex items-center cursor-pointer"
                    onClick={() => setAllowAiCreativity(!allowAiCreativity)}
                >
                    <input 
                        type="checkbox" 
                        id="ai-creativity-toggle" 
                        className="sr-only peer" 
                        checked={allowAiCreativity} 
                        readOnly 
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
            </div>
            {strictPreservation && <p className="text-xs text-blue-600 mt-2 text-center">*AI sáng tạo bị tắt khi bật chế độ giữ nguyên 100%.</p>}
        </>
    )
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200">
      <input
        type="file"
        ref={customOutfitInputRef}
        onChange={handleCustomOutfitUpload}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg overflow-hidden border border-transparent dark:border-slate-700">
          <div className="p-6 sm:p-10">
            <div className="text-center mb-8 sm:mb-10">
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">Ảnh Thẻ Chuyên Nghiệp Trong Vài Giây</h2>
                <p className="mt-3 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Sử dụng AI để tạo ảnh thẻ đáp ứng mọi tiêu chuẩn chỉ với vài cú nhấp chuột.</p>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              {/* Left Column: Controls */}
              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-4 text-base">1</span>
                        Tải ảnh chân dung
                      </h3>
                      {/* Batch Mode Toggle */}
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-full p-1 pl-3 border border-slate-200 dark:border-slate-600">
                          <span className={`text-xs font-bold ${isBatchMode ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500'}`}>Làm hàng loạt</span>
                          <div 
                                className="relative inline-flex items-center cursor-pointer"
                                onClick={() => {
                                    setIsBatchMode(!isBatchMode);
                                    handleReset(); // Reset state when switching modes
                                }}
                            >
                                <input type="checkbox" className="sr-only peer" checked={isBatchMode} readOnly />
                                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                            </div>
                      </div>
                  </div>
                  
                  <p className="text-slate-500 dark:text-slate-400 mb-4 ml-12">
                      {isBatchMode 
                        ? 'Tải lên nhiều ảnh để xử lý cùng lúc. Các tùy chọn bên dưới sẽ áp dụng cho tất cả ảnh.' 
                        : 'Để có kết quả tốt nhất, hãy sử dụng ảnh chụp chính diện, đủ sáng.'}
                  </p>
                  
                  <div className="ml-12">
                    <PhotoUploader 
                        onImageUpload={setUploadedImage} 
                        onBatchUpload={handleBatchFilesUpload}
                        previewUrl={uploadedImagePreview} 
                        allowMultiple={isBatchMode}
                    />
                    {!isBatchMode && (isAnalyzing || analysisResult) && (
                        <ImageAnalysisFeedback result={analysisResult} isLoading={isAnalyzing} />
                    )}
                    
                    {isBatchMode && batchImages.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between items-center">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Danh sách ảnh ({batchImages.length})</p>
                                <button onClick={() => setBatchImages([])} className="text-xs text-red-500 hover:underline">Xóa tất cả</button>
                            </div>
                            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                                {batchImages.map(img => (
                                    <div key={img.id} className="relative aspect-square group">
                                        <img src={img.previewUrl} alt="thumb" className="w-full h-full object-cover rounded-md border border-slate-200 dark:border-slate-600" />
                                        <button 
                                            onClick={() => handleRemoveBatchImage(img.id)}
                                            className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <TrashIcon className="w-3 h-3"/>
                                        </button>
                                        {img.status === 'processing' && (
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-md">
                                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                        {img.status === 'done' && (
                                            <div className="absolute bottom-0.5 right-0.5 bg-green-500 text-white rounded-full p-0.5">
                                                <CheckIcon className="w-3 h-3" strokeWidth={3}/>
                                            </div>
                                        )}
                                        {img.status === 'error' && (
                                            <div className="absolute bottom-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5" title={img.error}>
                                                <span className="text-[10px] font-bold px-1">!</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                  </div>
                </div>
                
                <div id="step2">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold mr-4 text-base">2</span>
                    Tùy chỉnh thông minh
                  </h3>
                   <p className="text-slate-500 dark:text-slate-400 mb-4 ml-12">Chọn mẫu có sẵn hoặc tùy chỉnh theo ý muốn của bạn.</p>
                  <div className="space-y-6 ml-12">
                     <OptionSelector<CountryTemplate>
                      label="Mẫu theo quốc gia"
                      options={COUNTRY_TEMPLATES}
                      selectedOption={selectedCountryTemplate}
                      onSelect={setSelectedCountryTemplate}
                      renderOption={(option) => (
                        <div className="flex items-center">
                          <GlobeIcon className="w-5 h-5 mr-3 text-slate-500 dark:text-slate-400" />
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{option.name}</span>
                        </div>
                      )}
                    />
                    <TabbedControls tabs={tabContent} />

                    {/* ULTRA HD TOGGLE MOVED HERE */}
                    <div className="mt-6 flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                        <label htmlFor="ultra-hd-toggle" className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 cursor-pointer select-none">
                            <span className="flex items-center justify-center w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full">4K</span>
                            Chế độ Ultra HD (4K)
                            <span className="tooltip-container" data-tooltip="Tự động tăng độ phân giải và chi tiết ảnh lên gấp 4 lần sau khi tạo. Quá trình sẽ lâu hơn khoảng 5-10 giây mỗi ảnh.">
                                (?)
                            </span>
                        </label>
                        <div 
                            className="relative inline-flex items-center cursor-pointer"
                            onClick={() => setIsUltraHD(!isUltraHD)}
                        >
                            <input 
                                type="checkbox" 
                                id="ultra-hd-toggle" 
                                className="sr-only peer" 
                                checked={isUltraHD} 
                                readOnly
                            />
                            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Right Column: Output */}
              <div className="sticky top-24">
                 <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                     <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 text-center">
                       {isBatchMode 
                            ? `Tiến độ xử lý (${Math.round(batchProgress)}%)` 
                            : (generatedImage ? 'So sánh kết quả' : isLoading ? (isUltraHD ? 'AI đang xử lý & nâng cấp 4K...' : 'AI đang sáng tạo...') : 'Xem trước kết quả')}
                    </h3>
                    
                    <div className="aspect-square relative">
                        {isBatchMode ? (
                            <div className="w-full h-full bg-white dark:bg-slate-800/50 rounded-lg p-4 overflow-y-auto border-2 border-dashed border-slate-300 dark:border-slate-600">
                                {batchImages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <p>Chưa có ảnh nào</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-3">
                                        {batchImages.map(img => (
                                            <div key={img.id} className="relative aspect-square group cursor-pointer" onClick={() => img.resultUrl && setZoomedImageUrl(img.resultUrl)}>
                                                <img 
                                                    src={img.resultUrl || img.previewUrl} 
                                                    alt="batch item" 
                                                    className={`w-full h-full object-cover rounded-md border-2 ${img.status === 'done' ? 'border-green-500' : img.status === 'error' ? 'border-red-500' : 'border-slate-200'}`} 
                                                />
                                                {img.status === 'processing' && (
                                                    <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center">
                                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                    </div>
                                                )}
                                                {img.status === 'done' && (
                                                    <div className="absolute bottom-1 right-1 bg-green-500 text-white text-[10px] px-1 rounded">Xong</div>
                                                )}
                                                {img.status === 'error' && (
                                                    <div className="absolute bottom-1 right-1 bg-red-500 text-white text-[10px] px-1 rounded">Lỗi</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {isLoading && <Loader />}
                                {!isLoading && generatedImage && uploadedImagePreview && (
                                    <ResultView 
                                        originalImageUrl={uploadedImagePreview} 
                                        generatedImageUrl={generatedImage} 
                                        onZoomRequest={setZoomedImageUrl}
                                    />
                                )}
                                {!isLoading && !generatedImage && (
                                    <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800/50 p-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p className="mt-4 text-base font-semibold text-slate-500 dark:text-slate-400">Kết quả của bạn sẽ xuất hiện ở đây</p>
                                        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Hoàn tất các bước để bắt đầu tạo ảnh.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    
                    <div className="mt-6 space-y-4">
                        {/* Single Mode Download Buttons */}
                        {!isBatchMode && generatedImage && (
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleDownload('jpeg')}
                                    className="w-full bg-blue-600 text-white text-center font-bold py-3 px-2 rounded-lg hover:bg-blue-700 transition-colors text-sm shadow"
                                >
                                    Tải JPG
                                </button>
                                <button
                                    onClick={() => handleDownload('png')}
                                    className="w-full bg-sky-500 text-white text-center font-bold py-3 px-2 rounded-lg hover:bg-sky-600 transition-colors text-sm shadow"
                                >
                                    Tải PNG
                                </button>
                            </div>
                        )}

                        {/* Batch Mode Actions */}
                        {isBatchMode && batchImages.some(img => img.status === 'done') && (
                             <button
                                onClick={handleBatchDownloadZip}
                                disabled={isLoading}
                                className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow disabled:opacity-50"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                Tải tất cả (ZIP)
                            </button>
                        )}

                        {/* Main Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            {isLoading && isBatchMode ? (
                                <button
                                    onClick={handleStopBatch}
                                    className="w-full col-span-2 bg-red-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-600 transition-colors shadow"
                                >
                                    Dừng xử lý
                                </button>
                            ) : (
                                <>
                                    {(!isBatchMode ? uploadedImage : batchImages.length > 0) && (
                                        <button
                                            onClick={handleGenerateClick}
                                            disabled={isGenerateDisabled}
                                            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center text-base shadow"
                                        >
                                            {isBatchMode 
                                                ? (batchImages.some(i => i.status === 'done') ? 'Xử lý các ảnh còn lại' : 'Bắt đầu xử lý hàng loạt') 
                                                : (generatedImage ? 'Tạo lại với tùy chỉnh mới' : 'Tạo ảnh ngay')}
                                        </button>
                                    )}
                                    <button
                                        onClick={handleReset}
                                        className={`w-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-100 text-center font-bold py-3 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors text-base ${(!isBatchMode && !uploadedImage) ? 'col-span-2' : ''}`}
                                    >
                                        Tạo mới
                                    </button>
                                </>
                            )}
                        </div>
                        
                        {!isBatchMode && !generatedImage && (
                             <div>
                                <label htmlFor="custom-prompt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Yêu cầu thêm (tùy chọn)</label>
                                <textarea
                                    id="custom-prompt"
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="Ví dụ: làm cho tóc gọn gàng hơn, xóa kính..."
                                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    rows={2}
                                />
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
            </div>
          </div>
        </div>
      </main>
      {zoomedImageUrl && (
        <ZoomModal 
            imageUrl={zoomedImageUrl} 
            onClose={() => setZoomedImageUrl(null)} 
            onDownload={handleZoomDownload}
        />
      )}
    </div>
  );
};
