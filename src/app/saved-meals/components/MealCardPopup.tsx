
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { taranaai } from '../../../../public';

interface MealItem {
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface MealCardPopupProps {
  restaurantName: string;
  restaurantLocation: string;
  items: MealItem[];
  onClose: () => void;
  onMarkAsUsed: () => void;
}

const MealCardPopup = ({ 
  restaurantName, 
  restaurantLocation, 
  items, 
  onClose,
  onMarkAsUsed 
}: MealCardPopupProps) => {
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl mx-auto flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-1 rounded-full">
                    <Image src={taranaai} alt="Tarana Eats" width={62} height={62} className="rounded-full" />
                </div>
                <div>
                    <h2 className="font-bold text-lg">Tarana Eats</h2>
                    <p className="text-sm opacity-90">Show this card to cafe staff for confirmation.</p>
                </div>
            </div>
            <button onClick={onClose} className="text-white">
                <X size={24} />
            </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-grow">
          <div className="text-left mb-4">
            <h3 className="text-2xl font-bold text-gray-900">{restaurantName}</h3>
            <p className="text-gray-500 mt-1">{restaurantLocation}</p>
          </div>
          
          <div className={`space-y-4 pr-2 ${items.length > 2 ? 'max-h-[45vh] overflow-y-auto' : ''}`}>
            {items.map((item, index) => (
              <div key={index} className="border-2 border-gray-200 bg-white rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0 relative overflow-hidden">
                    <Image src={item.image || taranaai} alt={item.name} layout="fill" className="object-cover" />
                  </div>
                  <div>
                    <p className="font-bold text-xl text-gray-800">{item.name}</p>
                    <p className="text-gray-500 text-base">₱{item.price} x {item.quantity}</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-blue-600">₱{item.price * item.quantity}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 mt-auto">
            <div className="flex justify-between items-center text-sm mb-3">
                <div>
                    <p className="text-gray-500">Selected Items ({totalItems})</p>
                    <p className="font-bold text-xl text-gray-900">Total: ₱{totalPrice.toFixed(2)}</p>
                </div>
                <div className="text-right">
                    <p className="text-gray-500">Valid Until</p>
                    <p className="font-bold text-gray-900">{validUntil.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
            </div>
            <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 h-auto rounded-lg text-base"
                onClick={onMarkAsUsed}
            >
                Mark as Used
            </Button>
        </div>
      </div>
    </div>
  );
};

export default MealCardPopup;