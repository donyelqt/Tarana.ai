import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SavedMeal } from "@/app/saved-meals/data";
import { Utensils, Users, MapPin, Coffee, Pizza, Croissant, Trash2, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useSession } from 'next-auth/react'
import { deleteMeal, saveMeal, getMealNotes, updateMealNotes } from '@/lib/data/supabaseMeals';
import { useQueryClient } from '@tanstack/react-query';

interface MealCardProps {
  meal: SavedMeal;
}

const MealTypeIcon = ({ mealType }: { mealType: SavedMeal['mealType'] }) => {
  switch (mealType) {
    case 'Breakfast':
      return <Coffee size={16} className="text-gray-500" />;
    case 'Dinner':
      return <Utensils size={16} className="text-gray-500" />;
    case 'Snack':
      return <Croissant size={16} className="text-gray-500" />;
    default:
      return <Pizza size={16} className="text-gray-500" />;
  }
};

const MealCard = ({ meal }: MealCardProps) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!session?.user?.id) return;
    try {
      const success = await deleteMeal(meal.id);
      if (success) {
        await queryClient.invalidateQueries({ queryKey: ['saved-meals'] });
        await queryClient.invalidateQueries({ queryKey: ['saved-meal', meal.id] });
        
        toast({
          title: "Success",
          description: "Meal deleted successfully!",
          variant: "success",
        });
        router.refresh();
      } else {
        throw new Error('Failed to delete meal');
      }
    } catch (error) {
      console.error("Error deleting meal:", error);
      toast({
        title: "Error",
        description: "Failed to delete meal. Please try again.",
        variant: "destructive",
      });
    }
    setShowDeleteModal(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState(meal.cafeName);
  const [editNotes, setEditNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const handleEditClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const existing = await getMealNotes(meal.id);
    if (existing) {
      setEditTitle(existing.title ?? meal.cafeName);
      setEditNotes(existing.notes ?? '');
    } else {
      setEditTitle(meal.cafeName);
      setEditNotes('');
    }
    setShowEditModal(true);
  };

  const handleSaveNotes = async () => {
    if (!session?.user?.id) return;
    setIsSavingNotes(true);
    try {
      const success = await updateMealNotes(meal.id, {
        title: editTitle.trim() || null,
        notes: editNotes.trim() || null,
      });
      if (success) {
        toast({ title: 'Success', description: 'Notes saved successfully', variant: 'success' });
        queryClient.invalidateQueries({ queryKey: ['saved-meals'] });
        setShowEditModal(false);
      } else {
        toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
  };

  return (
    <>
      <div className="group relative overflow-hidden rounded-3xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] hover:-translate-y-1">
        <div className="relative h-48">
          <Image
            src={
              meal.image && (meal.image.startsWith("/") || meal.image.startsWith("http://") || meal.image.startsWith("https://"))
                ? meal.image
                : "/assets/images/placeholder.png"
            }
            alt={meal.cafeName ? meal.cafeName : "Meal image"}
            layout="fill"
            objectFit="cover"
          />
        </div>
        <div className="p-5">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-bold text-gray-900">{meal.cafeName}</h3>
            <div className="flex items-center text-sm text-gray-600">
              <MealTypeIcon mealType={meal.mealType} />
              <span className="ml-1.5">{meal.mealType}</span>
            </div>
          </div>

          <p className="text-2xl font-bold text-blue-600 my-2">
            ₱{meal.price}
          </p>

          <div className="flex items-center text-sm text-gray-500 mb-1">
            <Users size={16} className="mr-2" />
            <span>Good for {meal.goodFor}</span>
          </div>

          <div className="flex items-center text-sm text-gray-500">
            <MapPin size={16} className="mr-2" />
            <span>{meal.location}</span>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Link href={`/saved-meals/${meal.id}`} passHref className="flex-1">
              <Button className="flex-1 w-full h-10 bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white font-medium py-2 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5">
                View Full Menu
              </Button>
            </Link>
            <Button 
              variant="outline" 
              className="h-10 border-gray-300 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-gray-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              onClick={handleEditClick}
            >
              <Pencil size={16} />
            </Button>
            <Button 
              variant="outline" 
              className="h-10 border-gray-300 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              onClick={handleDeleteClick}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </div>

      {}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-gray-200/60 p-8 max-w-sm w-full animate-in zoom-in-95 duration-300">
            <h2 className="text-lg font-bold mb-4 text-gray-900">Delete Meal</h2>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete <span className="font-semibold">{meal.cafeName}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button className="bg-gray-200 hover:bg-gray-300 text-black rounded-xl transition-all duration-300 hover:-translate-y-0.5" onClick={handleCancelDelete}>Cancel</Button>
              <Button className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all duration-300 hover:-translate-y-0.5 shadow-lg shadow-red-500/30" onClick={handleConfirmDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
      {}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-gray-200/60 p-8 max-w-md w-full animate-in zoom-in-95 duration-300">
            <h2 className="text-lg font-bold mb-4 text-gray-900">Edit Notes</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  maxLength={200}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nickname for this meal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  maxLength={5000}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[100px]"
                  placeholder="What did you think? Any dietary notes?"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button className="bg-gray-200 hover:bg-gray-300 text-black rounded-xl transition-all duration-300 hover:-translate-y-0.5" onClick={handleCancelEdit}>Cancel</Button>
              <Button
                className="bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
              >
                {isSavingNotes ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>);
  };

export default MealCard;