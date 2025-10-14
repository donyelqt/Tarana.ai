import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SavedMeal } from "@/app/saved-meals/data";
import { Utensils, Users, MapPin, Coffee, Pizza, Croissant, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useSession } from 'next-auth/react'
import { deleteMeal, saveMeal } from '@/lib/data/supabaseMeals';

interface MealCardProps {
  meal: SavedMeal;
  onDelete?: () => void;
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

const MealCard = ({ meal, onDelete }: MealCardProps) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!session?.user?.id) return;
    try {
      const success = await deleteMeal(session.user.id, meal.id);
      if (success) {
        toast({
          title: "Success",
          description: "Meal deleted successfully!",
          variant: "success",
        });
        if (onDelete) {
          onDelete();
        } else {
          router.refresh();
        }
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
              <Button className="flex-1 w-full h-10 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium py-2 px-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5">
                View Full Menu
              </Button>
            </Link>
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

      {/* Delete Confirmation Modal */}
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
    </>
  );
};

export default MealCard;