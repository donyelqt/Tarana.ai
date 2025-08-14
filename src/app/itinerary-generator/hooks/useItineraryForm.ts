import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { FormData } from '../types';

interface UseItineraryFormProps {
  initialBudget?: string;
  initialPax?: string;
  initialDuration?: string;
  initialDates?: { start: Date | undefined; end: Date | undefined };
  initialInterests?: string[];
}

export const useItineraryForm = ({
  initialBudget = '',
  initialPax = '',
  initialDuration = '',
  initialDates = { start: undefined, end: undefined },
  initialInterests = []
}: UseItineraryFormProps = {}) => {
  const { toast } = useToast();
  
  // Form state
  const [budget, setBudget] = useState(initialBudget);
  const [pax, setPax] = useState(initialPax);
  const [duration, setDuration] = useState(initialDuration);
  const [dates, setDates] = useState(initialDates);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(initialInterests);

  // Form UI state
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingItinerary, setIsLoadingItinerary] = useState(false);

  /**
   * Handle interest selection/deselection
   */
  const handleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  /**
   * Validate the form data
   */
  const validateForm = (formData: FormData): { isValid: boolean; error?: string } => {
    if (!formData.budget || !formData.pax || !formData.duration || formData.selectedInterests.length === 0) {
      return {
        isValid: false,
        error: "Please fill in all required fields"
      };
    }

    // Validate travel dates match duration if both are provided
    if (formData.dates.start && formData.dates.end && formData.duration) {
      const startDate = new Date(formData.dates.start);
      const endDate = new Date(formData.dates.end);
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      const durationMatch = formData.duration.match(/\d+/);
      const durationNum = durationMatch ? parseInt(durationMatch[0], 10) : NaN;
      
      if (!isNaN(durationNum) && diffDays !== durationNum) {
        return {
          isValid: false,
          error: `The selected travel dates (${diffDays} days) do not match the chosen duration (${durationNum} days). Please adjust your dates.`
        };
      }
    }

    return { isValid: true };
  };

  /**
   * Reset the form to its initial state
   */
  const resetForm = () => {
    setBudget(initialBudget);
    setPax(initialPax);
    setDuration(initialDuration);
    setDates(initialDates);
    setSelectedInterests(initialInterests);
    setShowPreview(false);
    setIsGenerating(false);
    setIsLoadingItinerary(false);
  };

  /**
   * Get the current form data as an object
   */
  const getFormData = (): FormData => ({
    budget,
    pax,
    duration,
    dates,
    selectedInterests,
  });

  /**
   * Prepare the form for submission
   */
  const prepareFormSubmission = (): { formData: FormData | null; isValid: boolean } => {
    const formData = getFormData();
    const { isValid, error } = validateForm(formData);
    
    if (!isValid && error) {
      toast({
        title: "Missing Information",
        description: error,
        variant: "destructive",
      });
      return { formData: null, isValid: false };
    }
    
    return { formData, isValid: true };
  };

  return {
    // Form state
    budget,
    setBudget,
    pax,
    setPax,
    duration,
    setDuration,
    dates,
    setDates,
    selectedInterests,
    setSelectedInterests,
    
    // UI state
    showPreview,
    setShowPreview,
    isGenerating,
    setIsGenerating,
    isLoadingItinerary,
    setIsLoadingItinerary,
    
    // Functions
    handleInterest,
    validateForm,
    resetForm,
    getFormData,
    prepareFormSubmission,
  };
};