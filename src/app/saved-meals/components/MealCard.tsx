import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SavedMeal } from "@/app/saved-meals/data";
import { Utensils, Users, MapPin, Coffee, Pizza, Croissant, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useSession } from 'next-auth/react'
import { deleteMeal } from '@/lib/supabaseMeals'

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

  return (
    <>
      <div className="bg-white rounded-2xl shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300">
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
              <Button className="flex-1 w-full bg-[#0066FF] hover:bg-[#0052cc] text-white font-medium py-2 px-4 rounded-xl transition-colors">
                View Full Menu
              </Button>
            </Link>
            <Button 
              variant="outline" 
              className="h-10 border-gray-300 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
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
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-4 text-gray-900">Delete Meal</h2>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete <span className="font-semibold">{meal.cafeName}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button className="bg-gray-200 hover:bg-gray-300 text-black" onClick={handleCancelDelete}>Cancel</Button>
              <Button className="bg-gradient-to-b from-blue-700 to-blue-500 hover:bg-opacity-90 text-white" onClick={handleConfirmDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MealCard;