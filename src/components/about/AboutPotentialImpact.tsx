import Image from 'next/image';

const impactStats = [
  {
    value: '30%',
    description: (
      <>
        <span className="font-semibold">reduction in foot traffic</span> at<br />
        overcrowded tourist spots
      </>
    ),
  },
  {
    value: '2x',
    description: (
      <>
        <span className="font-semibold">increase in visits</span> to<br />
        lesser-known local businesses
      </>
    ),
  },
  {
    value: '25%',
    description: (
      <>
        <span className="font-semibold">shorter average trip</span><br />
        planning time
      </>
    ),
  },
  {
    value: '20%',
    description: (
      <>
        <span className="font-semibold">decrease in traffic</span><br />
        congestion near key attractions
      </>
    ),
  },
];

export default function AboutPotentialImpact() {
  return (
    <div className="w-full flex flex-col items-center py-10 bg-white">
      <div className="w-[90%] max-w-5xl rounded-4xl overflow-hidden mb-10">
        <Image
          src="/images/potentialimpact.png"
          alt="Potential Impact"
          width={1200}
          height={400}
          className="w-full h-[340px] object-cover"
          priority
        />
      </div>
      <div className="text-center text-neutral-600 text-base mb-8">Our Potential Impact</div>
      <div className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-stretch divide-y md:divide-y-0 md:divide-x divide-gray-300">
        {impactStats.map((stat, idx) => (
          <div
            key={idx}
            className="flex-1 flex flex-col items-center px-2 py-6 md:px-4 md:py-0 first:pt-0 last:pb-0 md:first:pl-0 md:last:pr-0"
          >
            <div className="text-blue-600 text-4xl md:text-5xl font-bold mb-2">{stat.value}</div>
            <div className="text-gray-700 text-base md:text-base leading-tight text-center">
              {stat.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 