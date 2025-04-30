import Image from 'next/image';
import { how_it_works } from '../../public';

const HowItWorksSection = () => {
  return (
    <section className="bg-gradient-to-b from-blue-700 to-blue-500 text-white py-4">
      <div className="max-w-8xl mx-auto px-4">
        {/* Centered Image */}
        <div className="flex justify-center mr-12 h-auto">
          <Image
            src={how_it_works}
            alt="How It Works Process"
            width={500}
            height={700}
            className="w-[1200px] h-[600px] object-contain"
            quality={100}
          />
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;