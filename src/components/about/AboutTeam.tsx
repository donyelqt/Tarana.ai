import Image from 'next/image';
import { FaFacebookF, FaLinkedinIn } from 'react-icons/fa';
import { useState } from 'react';

const teamMembers = [
  {
    name: 'Gemwil Salayog',
    title: 'Chief Executive Officer',
    image: '/images/Gemwil.png',
    description:
      'As the CEO of Tarana-ai, I lead our mission to transform the way people plan their travels by integrating advanced AI with real-world travel insights. Our goal is to make personalized trip planning not only possible but seamless and accessible for everyone. Each day, we work to develop intelligent, user-centric solutions that turn travel ideas into well-crafted, memorable experiences.',
    facebook: '#',
    linkedin: '#',
  },
  {
    name: 'Doniele Arys Antonio',
    title: 'Chief Technology Officer',
    image: '/images/Doniele.png',
    description:
      'I serve as the CTO and Lead Full Stack AI Engineer at Tarana-ai, an AI-powered itinerary application that intelligently adapts to real-time traffic, weather, crowd density, and individual user preferences. Where I led the end-to-end software development of the platform from the ground up to production deployment.',
    facebook: '#',
    linkedin: '#',
  },
  {
    name: 'Cedric Navalta',
    title: 'Chief Marketing Officer',
    image: '/images/Cedric.png',
    description:
      'Hi! I\'m Cedric, Chief Marketing Officer at Tarana.ai, where I shape the brand\'s visual and narrative identity through design, storytelling, and strategy. With a sharp eye for detail and a passion for bringing ideas to life, I craft experiences that reflect who we are and the journeys we help create. Tara na! Plan. Travel. Enjoy.',
    facebook: '#',
    linkedin: '#',
  },
  {
    name: 'Leandro Gepila',
    title: 'Chief Product Officer',
    image: '/images/Leandro.png',
    description:
      'As Chief Product Officer at Tarana-ai, I lead the design and vision for user-centric travel solutions. My focus is on creating seamless, intuitive experiences that empower travelers to explore with confidence.',
    facebook: '#',
    linkedin: '#',
  },
  {
    name: 'Jasper Gubatan',
    title: 'Chief Architect',
    image: '/images/Jasper.png',
    description:
      'Hello! I\'m Jasper Gubatan, the Chief Architect at Tarana-ai. I work on the back-end of Tarana-ai. As a key member of the team, I ensure that the entire product lifecycle from concept and development to launch and iteration will align with the team\'s vision and its overall business goals.',
    facebook: '#',
    linkedin: '#',
  },
];

function TeamCard({ member }: { member: typeof teamMembers[0] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative rounded-4xl overflow-hidden shadow-2xl flex flex-col items-center justify-end h-[500px] bg-gray-100 group cursor-pointer transition-all duration-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="absolute inset-0 w-full h-full p-6">
        <Image
          src={member.image}
          alt={member.name}
          fill
          style={{
            objectFit: member.name === 'Leandro Gepila' ? 'contain' : 'contain',
            objectPosition: member.name === 'Leandro Gepila' ? 'bottom' : 'center',
          }}
          quality={100}
          className="w-full h-full rounded-2xl transition-all duration-300"
          priority
        />
      </div>
      {/* Overlay */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          hovered
            ? 'bg-gradient-to-b from-blue-600 to-blue-500/90 opacity-100'
            : 'bg-gradient-to-t from-blue-600/100 via-white/10 to-transparent opacity-80'
        }`}
      />
      {/* Default name/title (hidden on hover) */}
      <div
        className={`relative z-10 p-6 w-full text-center mt-auto transition-opacity duration-300 ${
          hovered ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <h3 className="text-white text-xl font-semibold mb-1">{member.name}</h3>
        <p className="text-white text-base">{member.title}</p>
      </div>
      {/* Hover content */}
      <div
        className={`absolute inset-0 flex flex-col items-start justify-center z-20 transition-opacity duration-300 ${
          hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } py-10 px-10`}
      >
        <h3 className="text-white text-2xl font-semibold mb-1 text-left">{member.name}</h3>
        <p className="text-blue-200 text-lg mb-4 text-left">{member.title}</p>
        <p className="text-white text-base mb-8 text-left leading-relaxed">
          {member.description}
        </p>
        <div className="flex gap-6 mt-auto">
          <a
            href={member.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="w-16 h-16 flex items-center justify-center rounded-full border-2 border-white text-white hover:bg-white hover:text-blue-600 transition-colors duration-200"
          >
            <FaFacebookF size={36} />
          </a>
          <a
            href={member.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="w-16 h-16 flex items-center justify-center rounded-full border-2 border-white text-white hover:bg-white hover:text-blue-600 transition-colors duration-200"
          >
            <FaLinkedinIn size={36} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AboutTeam() {
  return (
    <section className="w-full flex flex-col items-center justify-center py-16 px-4 bg-white">
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row md:items-start md:justify-between">
        <div className="mb-8 md:mb-0">
          <h2 className="text-4xl md:text-5xl font-semibold mb-4 text-left">
            Meet the <span className="text-blue-600">Team</span>
          </h2>
        </div>
        <div className="max-w-xl text-gray-600 text-base text-left md:ml-8">
          <p>
            At Tarana.ai, we believe better travel can unlock better cities.<br />
            Our team blends local insight, smart technology, and thoughtful design to ease congestion, spotlight hidden gems, and help Baguio move better—for both tourists and locals.
          </p>
        </div>
      </div>
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 w-full max-w-7xl mx-auto">
        {teamMembers.map((member) => (
          <TeamCard key={member.name} member={member} />
        ))}
      </div>
    </section>
  );
} 