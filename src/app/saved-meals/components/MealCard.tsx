import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SavedMeal } from "@/app/saved-meals/data";
import { Utensils, Users, MapPin, Coffee, Pizza, Croissant } from "lucide-react";

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
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300">
      <div className="relative h-48">
        <Image
          src={meal.image}
          alt={meal.cafeName}
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

        <Link href={`/saved-meals/${meal.id}`} passHref>
          <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
            View Full Menu
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default MealCard; 