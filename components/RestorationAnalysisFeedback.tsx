import React from 'react';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { UpscaleIcon } from './icons/UpscaleIcon';

interface AnalysisResult {
    needsUpscaling: boolean;
    reason: string;
}

interface RestorationAnalysisFeedbackProps {
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  isUpscaling: boolean;
  onUpscale: () => void;
}

export const RestorationAnalysisFeedback: React.FC<RestorationAnalysisFeedbackProps> = ({ result, isAnalyzing, isUpscaling, onUpscale }) => {
  if (isAnalyzing) {
    return (
      <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg flex items-center">
        <div className="w-4 h-4 border-2 border-slate-400 dark:border-slate-500 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin mr-3"></div>
        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Đang phân tích chất lượng ảnh...</p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const { needsUpscaling, reason } = result;

  return (
    <div className={`mt-4 p-4 rounded-lg ${needsUpscaling ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
      <h4 className="flex items-center text-sm font-semibold mb-3">
        <LightbulbIcon className={`w-5 h-5 mr-2 ${needsUpscaling ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} />
        <span className={`${needsUpscaling ? 'text-amber-800 dark:text-amber-300' : 'text-green-800 dark:text-green-300'}`}>Phân tích chất lượng</span>
      </h4>
      <p className="text-sm text-slate-700 dark:text-slate-200">{reason}</p>
      {needsUpscaling && (
        <button
            onClick={onUpscale}
            disabled={isUpscaling}
            className="w-full mt-4 bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors disabled:bg-amber-300 disabled:cursor-not-allowed flex items-center justify-center text-sm shadow"
        >
            {isUpscaling ? (
                <>
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2"></div>
                    Đang nâng cấp...
                </>
            ) : (
                <>
                    <UpscaleIcon className="w-5 h-5 mr-2" />
                    Nâng cấp ảnh
                </>
            )}
        </button>
      )}
    </div>
  );
};
