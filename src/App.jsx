/* eslint-disable react/no-unknown-property */
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { useGLTF, useTexture, Environment, Lightformer } from '@react-three/drei';
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import * as THREE from 'three';
import { Instagram, Twitter, Mail, ArrowRight, ArrowLeft, X, Download, Menu, ChevronLeft, ChevronRight, Linkedin, Github, MessageCircle, Youtube } from 'lucide-react';

// --- ASSET IMPORTS ---
import cardGLB from './assets/card.glb';
import lanyardImg from './assets/lanyard.png';
import resumePDF from './assets/resume.pdf';
import { PROJECTS_DATA } from './data/projects';

// Extend Three.js with MeshLine
extend({ MeshLineGeometry, MeshLineMaterial });

// --- LANYARD COMPONENT (Physics Mode) ---
function Band({ maxSpeed = 50, minSpeed = 0 }) {
  const band = useRef(), fixed = useRef(), j1 = useRef(), j2 = useRef(), j3 = useRef(), card = useRef();
  const vec = new THREE.Vector3(), ang = new THREE.Vector3(), rot = new THREE.Vector3(), dir = new THREE.Vector3();
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 4, linearDamping: 4 };
 
  // Load assets
  const { nodes, materials } = useGLTF(cardGLB);
  const texture = useTexture(lanyardImg);
 
  const [curve] = useState(() => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]));
  const [dragged, drag] = useState(false);
  const [hovered, hover] = useState(false);
  const [isSmall, setIsSmall] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => void (document.body.style.cursor = 'auto');
    }
  }, [hovered, dragged]);

  useEffect(() => {
    const handleResize = () => setIsSmall(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      const dir = vec.sub(state.camera.position).normalize();
      const distance = -state.camera.position.z / dir.z;
      const pos = state.camera.position.clone().add(dir.multiplyScalar(distance));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({ x: pos.x - dragged.x, y: pos.y - dragged.y, z: pos.z - dragged.z });
    }
    if (fixed.current) {
      [j1, j2].forEach((ref) => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        ref.current.lerped.lerp(ref.current.translation(), delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)));
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(32));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  curve.curveType = 'chordal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[2, 0, 0]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => (e.target.releasePointerCapture(e.pointerId), drag(false))}
            onPointerDown={(e) => (e.target.setPointerCapture(e.pointerId), drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation()))))}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial map={materials.base.map} map-anisotropy={16} clearcoat={1} clearcoatRoughness={0.15} roughness={0.9} metalness={0.8} />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial color="white" depthTest={false} resolution={isSmall ? [1000, 2000] : [1000, 1000]} useMap map={texture} repeat={[-4, 1]} lineWidth={1} />
      </mesh>
    </>
  );
}

function Lanyard({ position = [0, 0, 20], gravity = [0, -40, 0], fov = 20, transparent = true }) {
  return (
    <div className="lanyard-wrapper">
      <Canvas
        camera={{ position: position, fov: fov }}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={1 / 60}>
          <Band />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

// --- PORTFOLIO COMPONENTS ---

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 md:px-12 py-24 bg-black text-white">
      <div className="w-full max-w-4xl mx-auto text-center">
        <h1
          className="text-5xl md:text-8xl font-bold tracking-widest uppercase mb-8 animate-float delay-100"
        >
          GREY NGUYEN
        </h1>
        <p
          className="text-xs md:text-sm leading-relaxed max-w-3xl mx-auto uppercase tracking-wide text-gray-300 animate-float delay-200"
        >
          WHERE CURIOSITY MEETS PROBLEM SOLVING. THIS IS A SPACE WHERE I EXPLORE CYBERSECURITY, CODE, AND CREATIVITY TO BUILD SOLUTIONS THAT EMPOWER PEOPLE AND MAKE TECHNOLOGY FEEL A LITTLE MORE HUMAN.
        </p>
       
        <div className="animate-float delay-300">
          <a href="mailto:ntgngan3107@gmail.com" className="inline-block mt-16 text-xs md:text-sm font-bold uppercase tracking-widest hover:underline">
            NTGNGAN3107@GMAIL.COM
          </a>
        </div>
      </div>
    </div>
  );
};

const About = () => {
  const [activeTab, setActiveTab] = useState('INTRODUCTION');
  const tabs = ['INTRODUCTION', 'EDUCATION', 'EXPERIENCE', 'EXPERTISE'];

  const renderContent = () => {
    switch (activeTab) {
      case 'INTRODUCTION':
        return (
          <div className="uppercase leading-relaxed text-sm md:text-base font-medium space-y-8 animate-float delay-100">
            <p>
              I am a motivated Information Technology student at Curtin University with a strong foundation in cybersecurity, software development, and network systems.
              I focus on crafting solutions that make complex ideas intuitive, accessible, and human-centered.
            </p>
            <p>
              Aims to build technology that empowers people, supports communities, and sparks meaningful change.
              I'm committed to continuous learning and push the boundaries of what thoughtful technology can do.
            </p>
          </div>
        );
      case 'EDUCATION':
        return (
          <div className="uppercase leading-relaxed text-sm md:text-base font-medium space-y-8 animate-float delay-100">
            <div>
              <h3 className="font-bold mb-2">Curtin University</h3>
              <p className="text-gray-500">Bachelor of Computing in Cyber Security</p>
              <p className="text-gray-400 text-xs mt-1">2025 - Present</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Curtin College</h3>
              <p className="text-gray-500">Diploma of Information Technology</p>
              <p className="text-gray-400 text-xs mt-1">2023 - 2024</p>
            </div>
          </div>
        );
      case 'EXPERIENCE':
        return (
           <div className="uppercase leading-relaxed text-sm md:text-base font-medium space-y-8 animate-float delay-100">
            <div>
              <h3 className="font-bold mb-2">Software Engineering Intern</h3>
              <p className="text-gray-500">Aubot • Dec 2025-Present</p>
              <p className="text-sm mt-2">Designed and developed a comprehensive computer science learning platform for children, creating the web interfaces for students and guardians while writing specifications for automated coding exercises.</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Teaching Assisstant</h3>
              <p className="text-gray-500">Technologies for Kids • Sep 2025-Present</p>
              <p className="text-sm mt-2">Taught students aged 5 to 18 in drone coding & creative flight, coding & robotics, and 2D game design programs.</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Judge</h3>
              <p className="text-gray-500">MakeX Robotics Competition • Jul 2025</p>
              <p className="text-sm mt-2">Judge for the 2025 International Robotics Competition MakeX held at Perth Government House.</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Mentor</h3>
              <p className="text-gray-500">CoderDojo WA • Mar 2025-Present</p>
              <p className="text-sm mt-2">Mentored neurodivergent adolescents in Python coding and Lego Robotics.</p>
            </div>
          </div>
        );
      case 'EXPERTISE':
        return (
          <div className="uppercase leading-relaxed text-sm md:text-base font-medium animate-float delay-100">
            <div className="grid grid-cols-2 gap-4">
              <div>
                 <h3 className="font-bold mb-4 border-b border-black pb-2">Languages</h3>
                 <ul className="space-y-2 text-gray-600">
                   <li>Python</li>
                   <li>TypeScript</li>
                   <li>JavaScript</li>
                   <li>Java</li>
                   <li>C++</li>
                   <li>SQL</li>
                   <li>HTML/CSS</li>
                   <li>C</li>
                 </ul>
              </div>
              <div>
                 <h3 className="font-bold mb-4 border-b border-black pb-2">Frameworks & Libraries</h3>
                 <ul className="space-y-2 text-gray-600">
                   <li>Next.js</li>
                   <li>React.js</li>
                   <li>Node.js</li>
                   <li>Tailwind CSS</li>
                   <li>Framer Motion</li>
                   <li>Qt</li>
                   <li>PartyKit</li>
                   <li>OpenAI Whisper</li>
                 </ul>
              </div>
              <div>
                 <h3 className="font-bold mb-4 border-b border-black pb-2">Tools & Platform</h3>
                 <ul className="space-y-2 text-gray-600">
                   <li>Docker</li>
                   <li>Git</li>
                   <li>GitHub</li>
                   <li>GitLab</li>
                   <li>Vercel</li>
                   <li>Linux</li>
                   <li>Windows</li>
                   <li>LaTeX</li>
                   <li>AWS</li>
                   <li>Google Analytics</li>
                   <li>Mapbox</li>
                   <li>Clerk</li>
                 </ul>
              </div>
              <div>
                 <h3 className="font-bold mb-4 border-b border-black pb-2">Database & BaaS</h3>
                 <ul className="space-y-2 text-gray-600">
                   <li>PostgreSQL</li>
                   <li>Supabase</li>
                   <li>MongoDB</li>
                   <li>MySQL</li>
                   <li>SQLite</li>
                   <li>Firebase</li>
                 </ul>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Centered Name Header */}
      <div className="w-full text-center py-12 pt-32 animate-float">
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-widest">GREY NGUYEN</h1>
      </div>

      {/* Grid Layout: Lanyard Left, Content Right */}
      {/* Removed border-t and border-r to create seamless look */}
      <div className="flex-grow w-full grid grid-cols-1 lg:grid-cols-2">
       
        {/* Left: Lanyard Simulation */}
        <div className="h-[50vh] lg:h-screen w-full bg-[#ffffff] relative order-1 overflow-hidden animate-float delay-100">
           <Suspense fallback={null}>
              <Lanyard position={[0, 0, 20]} gravity={[0, -40, 0]} />
           </Suspense>
        </div>

        {/* Right: Content Area */}
        <div className="flex flex-col order-2 p-6 md:p-12 h-full relative">
         
          {/* Top: Tab Navigation (Sub-menu) */}
          <div className="flex flex-wrap gap-6 md:gap-8 mb-16 text-[10px] md:text-xs font-bold tracking-widest uppercase animate-float delay-200">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`transition-colors duration-300 ${
                  activeTab === tab ? 'text-black' : 'text-gray-300 hover:text-gray-400'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Middle: Dynamic Text Content */}
          <div className="flex-grow max-w-xl">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to render content with bold labels and bullet points
const renderFormattedContent = (content) => {
  if (!content) return null;
  
  // Split content by newlines
  const lines = content.split('\n');
  
  return lines.map((line, index) => {
    // Check if line starts with a bullet point (•)
    if (line.trim().startsWith('•')) {
      // Find the colon to separate label from description
      const colonIndex = line.indexOf(':');
      
      if (colonIndex !== -1) {
        // Extract label (text before colon) and description (text after colon)
        const label = line.substring(0, colonIndex + 1).trim(); // Include bullet and label with colon
        const description = line.substring(colonIndex + 1).trim(); // Description after colon
        
        return (
          <React.Fragment key={index}>
            <span className="font-bold text-black">{label}</span>
            {description && <span className="text-gray-600"> {description}</span>}
            {index < lines.length - 1 && <br />}
          </React.Fragment>
        );
      }
    }
    
    // For non-bullet lines, render as-is
    return (
      <React.Fragment key={index}>
        {line}
        {index < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

const ProjectDetail = ({ project, onNext, onPrev, onClose, hasNext, hasPrev }) => (
  <div className="min-h-screen bg-white animate-float pt-32 pb-24">
    <div className="max-w-5xl mx-auto px-6 md:px-12">
     
      {/* Close Button */}
      <button onClick={onClose} className="mb-12 flex items-center gap-2 text-xs uppercase tracking-widest font-bold hover:opacity-50 transition-opacity">
        <X size={16} /> Close Project
      </button>

      {/* Article Header */}
      <div className="text-center mb-16 animate-float delay-100">
        <h1 className="text-4xl md:text-6xl font-black uppercase leading-tight mb-4">{project.title}</h1>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{project.date}</p>
      </div>

      {/* Main Image */}
      <div className="w-full aspect-video bg-gray-200 mb-16 animate-float delay-200">
         <img src={project.images[0]} alt={project.title} className="w-full h-full object-cover" />
      </div>

      {/* Article Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-24 animate-float delay-300">
        <div className="md:col-span-4">
           <div className="sticky top-32">
              <h3 className="text-xs font-bold uppercase tracking-widest border-b border-black pb-2 mb-4">Details</h3>
              <div className="space-y-4 text-sm uppercase font-medium">
                <div>
                  <span className="block text-gray-400 text-[10px]">Category</span>
                  <span>{project.category}</span>
                </div>
                <div>
                  <span className="block text-gray-400 text-[10px]">Year</span>
                  <span>{project.date.split(' ')[1]}</span>
                </div>
                <div>
                  <span className="block text-gray-400 text-[10px]">Languages & Tools</span>
                  <span>{project.langs}</span>
                </div>
              </div>
           </div>
        </div>
        <div className="md:col-span-8">
           <p className="text-xl md:text-2xl leading-relaxed font-bold uppercase">{project.ov}</p>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.challenge}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium whitespace-pre-line">
             {renderFormattedContent(project.challenge_content)}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.solution}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium whitespace-pre-line">
             {renderFormattedContent(project.solution_content)}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.tech}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium whitespace-pre-line">
             {renderFormattedContent(project.tech_content)}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.feature}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium whitespace-pre-line">
             {renderFormattedContent(project.feature_content)}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.design}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium whitespace-pre-line">
             {renderFormattedContent(project.design_content)}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.perf}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium whitespace-pre-line">
             {renderFormattedContent(project.perf_content)}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.result}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium whitespace-pre-line">
             {renderFormattedContent(project.result_content)}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.future}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium whitespace-pre-line">
             {renderFormattedContent(project.future_content)}
           </div>
           <p className="mt-12 text-base md:text-base leading-relaxed font-bold uppercase">{project.conclusion}</p>
        </div>
      </div>

      {/* Secondary Images */}
      <div className="space-y-8 mb-24">
         {project.images.slice(1).map((img, idx) => (
            <img key={idx} src={img} alt="Detail" className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-700" />
         ))}
      </div>

    </div>

    {/* Footer Navigation */}
    <div className="border-t border-black py-8 px-6 md:px-12 max-w-7xl mx-auto flex justify-between items-center">
       <div className="w-32">
         {hasPrev && (
           <button onClick={onPrev} className="group flex items-center gap-2 text-sm font-bold uppercase tracking-widest hover:opacity-50 transition-opacity">
             <ChevronLeft size={16} /> Previous
           </button>
         )}
       </div>
       
       <div className="w-32 text-right">
         {hasNext && (
           <button onClick={onNext} className="group flex items-center justify-end gap-2 text-sm font-bold uppercase tracking-widest hover:opacity-50 transition-opacity">
             Next <ChevronRight size={16} />
           </button>
         )}
       </div>
    </div>
  </div>
);

const Projects = () => {
  const [selectedId, setSelectedId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(4);

  const currentIndex = PROJECTS_DATA.findIndex(p => p.id === selectedId);
 
  const handleNewer = () => {
    if (currentIndex > 0) {
      setSelectedId(PROJECTS_DATA[currentIndex - 1].id);
      window.scrollTo(0, 0);
    }
  };

  const handleOlder = () => {
    if (currentIndex < PROJECTS_DATA.length - 1) {
      setSelectedId(PROJECTS_DATA[currentIndex + 1].id);
      window.scrollTo(0, 0);
    }
  };
 
  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 4);
  };

  if (selectedId) {
    const project = PROJECTS_DATA.find(p => p.id === selectedId);
    return (
      <ProjectDetail
        project={project}
        onNext={handleOlder}
        onPrev={handleNewer}
        hasNext={currentIndex < PROJECTS_DATA.length - 1}
        hasPrev={currentIndex > 0}
        onClose={() => setSelectedId(null)}
      />
    );
  }

  const displayedProjects = PROJECTS_DATA.slice(0, visibleCount);

  return (
    <div className="min-h-screen pt-32 px-6 md:px-12 pb-24 animate-float">
      {/* NEWS-style Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-16 max-w-[1920px] mx-auto">
        {displayedProjects.map((project, index) => (
          <div
            key={project.id}
            onClick={() => setSelectedId(project.id)}
            className="group cursor-pointer flex flex-col gap-4 animate-float"
            style={{ animationDelay: `${(index % 4) * 0.1}s` }}
          >
            {/* Image Container */}
            <div className="w-full aspect-[3/2] bg-gray-200 overflow-hidden relative">
               <img
                 src={project.images[0]}
                 alt={project.title}
                 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
               />
               <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
            </div>

            {/* Text Container - Centered below image */}
            <div className="text-center pt-2">
               <h2 className="text-sm md:text-base font-bold uppercase tracking-wide mb-1 group-hover:underline underline-offset-4 decoration-1">
                 {project.title}
               </h2>
               <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-500">
                 {project.date}
               </span>
            </div>
          </div>
        ))}
      </div>
     
      {/* LOAD MORE BUTTON */}
      {visibleCount < PROJECTS_DATA.length && (
        <div className="flex justify-center mt-24 animate-float delay-200">
          <button
            onClick={handleLoadMore}
            className="bg-black text-white px-12 py-4 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

const Resume = () => (
  <div className="min-h-screen flex flex-col px-6 md:px-12 pt-32 pb-20 animate-float">
    <div className="flex justify-between items-end mb-8">
      <div>
      	<h1 className="text-6xl font-black uppercase">Resume</h1>
      	<p className="text-gray-500">Last Updated: Nov 2025</p>
      </div>
      <button className="flex items-center gap-2 bg-black text-white px-6 py-3 text-sm font-bold uppercase hover:bg-grey-800 transition-colors">
       <a href={resumePDF} download="Grey-Nguyen-Resume-Summer-2025.pdf" className="flex items-center gap-2 text-white hover:text-gray-300">
       	<Download size={16} /> Download PDF
       </a>
      </button>
    </div>
    <div className="relative w-full h-[200vh] border-2 border-black bg-gray-100 flex items-center justify-center animate-float delay-200 relative overflow-hidden">
      <object data={resumePDF} type="application/pdf" className="w-full h-full">
      	<div className="text-center p-12">
      		<p className="text-lg font-bold uppercase">RESUME.PDF</p>
      		<p className="text-gray-500 mb-6">Your browser does not support PDF embedding.</p>
      		<a href={resumePDF} download className="underline text-sm uppercase tracking-widest hover:text-gray-600">Download File</a>
      	</div>
      </object>
    </div>
  </div>
);

const App = () => {
  const [activePage, setActivePage] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isHome = activePage === 'home';
 
  // Reset scroll & animation state trigger
  useEffect(() => {
    window.scrollTo(0, 0);
    setMobileMenuOpen(false);
  }, [activePage]);

  const renderPage = () => {
    switch(activePage) {
      case 'home': return <Home />;
      case 'about': return <About />;
      case 'projects': return <Projects />;
      case 'resume': return <Resume />;
      default: return <Home />;
    }
  };
 
  const NavLink = ({ page, label }) => (
    <button
      onClick={() => setActivePage(page)}
      className={`uppercase text-sm font-bold tracking-widest hover:underline text-right ${activePage === page ? 'underline' : ''} ${isHome ? 'text-white' : 'text-black'}`}
    >
      {label}
    </button>
  );

  return (
    <div className={`min-h-screen selection:bg-black selection:text-white flex flex-col ${isHome ? 'bg-black' : 'bg-white text-black'}`}>
      <header className="fixed top-0 left-0 w-full z-50 p-8 flex items-start justify-between pointer-events-none">
        <button onClick={() => setActivePage('home')} className="pointer-events-auto w-12 h-12 rounded-full overflow-hidden border border-current"><img src="https://media.licdn.com/dms/image/v2/D5603AQEdh9orZjtRew/profile-displayphoto-shrink_200_200/B56ZOxKlKDGcAg-/0/1733844161776?e=2147483647&v=beta&t=ypxNMy-EFcsPKepA4b0Mp8o4cP9apnh0DBWaoAqucOs" className="w-full h-full object-cover grayscale-0 hover:grayscale" /></button>
        <nav className="pointer-events-auto hidden md:flex flex-col gap-1 items-end"><NavLink page="home" label="Home" /><NavLink page="about" label="About" /><NavLink page="projects" label="Projects" /><NavLink page="resume" label="Resume" /></nav>
        <button className={`md:hidden pointer-events-auto ${isHome && (!mobileMenuOpen) ? 'text-white' : 'text-black'}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <X /> : <Menu />}</button>
      </header>
      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-white pt-32 px-6 flex flex-col items-end gap-6 md:hidden"><button onClick={() => setActivePage('home')} className="text-black uppercase font-bold tracking-widest">Home</button><button onClick={() => setActivePage('about')} className="text-black uppercase font-bold tracking-widest">About</button><button onClick={() => setActivePage('projects')} className="text-black uppercase font-bold tracking-widest">Projects</button><button onClick={() => setActivePage('resume')} className="text-black uppercase font-bold tracking-widest">Resume</button></div>}
      <main className="flex-grow w-full max-w-[1920px] mx-auto">{renderPage()}</main>
      <footer className={`p-12 mt-auto w-full flex flex-col items-center gap-6 ${isHome ? 'bg-black text-white' : 'bg-white text-black border-t border-white'}`}>
        <div className="flex gap-8">
            <a href="https://www.linkedin.com/in/thai-gia-ngan-nguyen" className={`transition-opacity hover:opacity-60 ${isHome ? 'text-white' : 'text-black'}`}><Linkedin size={20} /></a>
            <a href="https://github.com/ThaiGiaNganNGUYEN" className={`transition-opacity hover:opacity-60 ${isHome ? 'text-white' : 'text-black'}`}><Github size={20} /></a>
            <a href="https://www.instagram.com/_noirxze_/" className={`transition-opacity hover:opacity-60 ${isHome ? 'text-white' : 'text-black'}`}><Instagram size={20} /></a>
            <a href="https://www.youtube.com/@Ng%C3%A2nTh%C3%A1i-m5r" className={`transition-opacity hover:opacity-60 ${isHome ? 'text-white' : 'text-black'}`}><Youtube size={20} /></a>
        </div>
        <div className="text-[10px] uppercase tracking-widest opacity-60">
           <span>© Thai Gia Ngan Nguyen.</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
