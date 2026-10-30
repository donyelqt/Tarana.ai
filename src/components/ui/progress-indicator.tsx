import React from 'react';
import { ProgressIndicatorProps } from '../../types/credit-tiers';

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentReferrals,
  targetReferrals,
  progressPercentage
}) => {
  if (typeof currentReferrals !== 'number' || !isFinite(currentReferrals)) {
    console.warn('ProgressIndicator: Invalid currentReferrals:', currentReferrals);
    return null;
  }
  
  if (typeof targetReferrals !== 'number' || !isFinite(targetReferrals) || targetReferrals <= 0) {
    console.warn('ProgressIndicator: Invalid targetReferrals:', targetReferrals);
    return null;
  }
  
  if (typeof progressPercentage !== 'number' || !isFinite(progressPercentage)) {
    console.warn('ProgressIndicator: Invalid progressPercentage:', progressPercentage);
    return null;
  }
  
  const clampedProgress = Math.min(100, Math.max(0, progressPercentage));
  
  const validCurrentReferrals = Math.max(0, Math.floor(currentReferrals));
  const validTargetReferrals = Math.max(1, Math.floor(targetReferrals));

  return (
    <div 
      className="w-full space-y-3" 
      role="progressbar" 
      aria-valuenow={clampedProgress} 
      aria-valuemin={0} 
      aria-valuemax={100}
      aria-label={`Progress towards next tier: ${validCurrentReferrals} of ${validTargetReferrals} friends referred`}
    >
      {}
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium text-gray-900">
          {validCurrentReferrals} / {validTargetReferrals} friends
        </div>
        <div className="text-xs font-medium text-gray-600" aria-hidden="true">
          {clampedProgress.toFixed(0)}%
        </div>
      </div>
      
      {}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner border border-gray-300">
        {}
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-blue-700 rounded-full transition-all duration-500 ease-out shadow-sm"
          style={{ width: `${clampedProgress}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

export default ProgressIndicator;