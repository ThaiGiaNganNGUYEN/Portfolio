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
              <h3 className="font-bold mb-2">Teaching Assisstant</h3>
              <p className="text-gray-500">Technologies for Kids • 2025-Present</p>
              <p className="text-sm mt-2">Taught students aged 5 to 18 in drone coding & creative flight, coding & robotics, and 2D game design programs.</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Judge</h3>
              <p className="text-gray-500">MakeX Robotics Competition • 2025</p>
              <p className="text-sm mt-2">Judge for the 2025 International Robotics Competition MakeX held at Perth Government House.</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Mentor</h3>
              <p className="text-gray-500">CoderDojo WA • 2025-Present</p>
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
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium">
             {project.challenge_content}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.solution}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium">
             {project.solution_content}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.tech}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium">
             {project.tech_content}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.feature}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium whitespace-pre-line">
             {project.feature_content}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.design}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium">
             {project.design_content}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.perf}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium">
             {project.perf_content}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.result}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium">
             {project.result_content}
           </div>
           <div className="mt-12 text-base leading-loose text-black normal-case font-medium">
             {project.future}
           </div>
           <div className="mt-1 text-base leading-loose text-gray-600 normal-case font-medium">
             {project.future_content}
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
             <ChevronLeft size={16} /> Next
           </button>
         )}
       </div>
       
       <div className="w-32 text-right">
         {hasNext && (
           <button onClick={onNext} className="group flex items-center justify-end gap-2 text-sm font-bold uppercase tracking-widest hover:opacity-50 transition-opacity">
             Previous <ChevronRight size={16} />
           </button>
         )}
       </div>
    </div>
  </div>
);

// --- MOCK DATA ---
const PROJECTS_DATA = [
  { 
  id: 1, title: "Laser Tank", date: "MAY 2024", category: "Game Development", 
  langs: "C, Makefile",
  ov: "A 2D terminal-based game where the player moves and shoots laser to defeat an enemy tank and win", 
  challenge: "CHALLENGE", 
  challenge_content: "The challenge is to implement a simple game inspired from a classical puzzle game 'Laser Tank'. ", 
  solution: "SOLUTION", 
  solution_content: "The program will read the parameters from an input file and utilize them for the game configuration and create a dynamically-allocated 2D char array to make a simple ASCII-based game then receive user input to control the flow of the game." , 
  tech: "TECHNICAL ARCHITECTURE", 
  tech_content: "The program is implemented using C with a Makefile to compile the program.", 
  feature: "KEY FEATURES", 
  feature_content: "1. Laser Reflection Physics: Lasers dynamically interact with mirrors and change direction based on the angle of reflection.\n2. Map Loading System: The game supports loading custom level layouts from text files, allowing for infinite replayability.\n3. Game Recording: 2D Dynamic Arrays for the map and a custom LinkedList for game history.", 
  design: "USER EXPERIENCE DESIGN",  
  design_content: "The game utilizes a clean, ASCII-based interface that prioritizes clarity. Controls are intuitive (WASD for movement, 'f' to fire), and visual feedback is provided through color-coded laser beams (red) and clear victory/defeat messages.", 
  perf: "PERFORMANCE", 
  perf_content: "The game is highly optimized with low memory footprint. Dynamic memory allocation is carefully managed with corresponding free calls to prevent leaks.", 
  result: "OUTCOMES", 
  result_content: "The project successfully demonstrates complex game logic in a low-level language. It resulted in a fully playable game that handles user input, file processing, and dynamic data structures robustly. The modular design allows for easy addition of new features.", 
  future: "FUTURE ENHANCEMENTS", 
  future_content: "Possible future enhancements include porting the rendering to ncurses for a smoother UI without screen clearing, implementing an algorithm for the enemy tank to hunt the player, and adding a level editor directly within the game.", 
  conclusion: "I successfully combined strategic gameplay with robust software engineering principles of low-level programming by building the engine from scratch in C. I gained a deep understanding of memory management, pointer arithmetic, and algorithm design. The final product is not just a functional game, but a system that serves as a strong foundation for future development in game programming.", 
  images: ["https://attachments.office.net/owa/t.nguyen409%40student.curtin.edu.au/service.svc/s/GetAttachmentThumbnail?id=AAkALgAAAAAAHYQDEapmEc2byACqAC%2FEWg0AVcQ71Ugf10K%2Bsf%2F9NvhMgwAAx3EqPgAAARIAEABgj3MeQaIxRK7oMTiImE8G&thumbnailType=2&token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjFsbFd5KzJBZkZaZVNLMEtYZGJTU3Z6UWxPYz0iLCJ4NXQiOiIxbGxXeSsyQWZGWmVTSzBLWGRiU1N2elFsT2M9Iiwibm9uY2UiOiJiLXJGU3ZONGpkbThNVmZHUGNmMlplb3VDaUZubjNocnZfeWFySWo5dkxoX29HMmpzMlZpN295LWlra0dMYVZCS3BuOXB2aC1sdkc4bE9QMzl0dlFqTlgwNlFWb243S01CRGsxS0ZCa1BfRHRySkNGbUF2eEJ3VWx4TWtvc2xXYy1Nb2NBSFg2Tm1mcUxiQi1UOGVvdlJjVFFadUlRRmM0VUxnMmJPdGVCOUUiLCJpc3Nsb2MiOiJTWThQMzAwTUIwOTA1Iiwic3JzbiI6NjM5MDAzODAxMzQ1OTkzMDcwfQ.eyJzYXAtdmVyc2lvbiI6IjMzIiwiYXBwaWQiOiJhZjNlYmJiYS1jMjNmLTQ5MmEtYWE5My04MzQyMTY5NmVjNGIiLCJpc3NyaW5nIjoiV1ciLCJhcHBpZGFjciI6IjIiLCJhcHBfZGlzcGxheW5hbWUiOiIiLCJ1dGkiOiJkODc1ZGUyNy00YjlmLTRkYzktODdiNC03MDc3NzI2YjQ2MTkiLCJpYXQiOjE3NjQ4NDMzMTMsInZlciI6IlNUSS5Vc2VyLkNhbGxiYWNrVG9rZW4uVjEiLCJ0aWQiOiI1YTc0MGNkNzU3Njg0ZDA5YWUxM2Y3MDZiMDlmYTIyYyIsInRydXN0ZWRmb3JkZWxlZ2F0aW9uIjoiZmFsc2UiLCJ0b3BvbG9neSI6IntcIlR5cGVcIjpcIk1hY2hpbmVcIixcIlZhbHVlXCI6XCJTWThQMzAwTUIwOTA1LkFVU1AzMDAuUFJPRC5PVVRMT09LLkNPTVwifSIsInJlcXVlc3Rvcl9hcHBpZCI6IjE1N2NkZmJmLTczOTgtNGE1Ni05NmMzLWU5M2U5YWIzMDliNSIsInJlcXVlc3Rvcl9hcHBfZGlzcGxheW5hbWUiOiJPZmZpY2UgMzY1IEV4Y2hhbmdlIE1pY3Jvc2VydmljZSIsInNjcCI6Ik93YUF0dGFjaG1lbnRzLlJlYWQiLCJvaWQiOiI5NjQ5OWY5MS0zZDdlLTRhOWEtODc2OS04MDM1MDBjYjEzY2UiLCJwdWlkIjoiMTAwMzIwMDQ0M0I0MTBFNiIsInNtdHAiOiJ0Lm5ndXllbjQwOUBzdHVkZW50LmN1cnRpbi5lZHUuYXUiLCJ1cG4iOiIyMjI1OTQ5OUBzdHVkZW50LmN1cnRpbi5lZHUuYXUiLCJ1c2VyY2FsbGJhY2t1c2VyY29udGV4dGlkIjoiMzI1MzMxMDA0MDVjNGUwNjljMDlkMzU3MzZiNDVhYTQiLCJzaWduaW5fc3RhdGUiOiJrbXNpIiwiZW1iZWRkZWR1c2VydG9rZW50eXBlIjoiQUFEIiwidXNlcmFjY2Vzc3Rva2VuIjoiZXlKMGVYQWlPaUpLVjFRaUxDSnViMjVqWlNJNklsOXBSMDVKV1VkZmRXNUdPR3huU0dKS2NqaFNkVXhPVlMxS1JEZDZkblYzZUhKcFRXZHRiVXRMVTJNaUxDSmhiR2NpT2lKU1V6STFOaUlzSW5nMWRDSTZJbkowYzBaVUxXSXROMHgxV1RkRVZsbGxVMDVMWTBsS04xWnVZeUlzSW10cFpDSTZJbkowYzBaVUxXSXROMHgxV1RkRVZsbGxVMDVMWTBsS04xWnVZeUo5LmV5SmhkV1FpT2lKb2RIUndjem92TDI5MWRHeHZiMnN1YjJabWFXTmxMbU52YlNJc0ltbHpjeUk2SW1oMGRIQnpPaTh2YzNSekxuZHBibVJ2ZDNNdWJtVjBMelZoTnpRd1kyUTNMVFUzTmpndE5HUXdPUzFoWlRFekxXWTNNRFppTURsbVlUSXlZeThpTENKcFlYUWlPakUzTmpRNE1qZzFNek1zSW01aVppSTZNVGMyTkRneU9EVXpNeXdpWlhod0lqb3hOelkwT1RJd056azRMQ0poWTJOMElqb3dMQ0poWTNJaU9pSXhJaXdpWVdsdklqb2lRVmhSUVdrdk9HRkJRVUZCVG5GRlZYWjJlRVpZUWxJd05rNUxRV2hCZWxwbk5FZFphVk5sZHpCbVVXVkhMMHc1YlhWS2RrUkdlbW8yZVUxS01rbFpXVWg0VnpWclRHNUpiMU5HTkM5dVJXZDFVWFJqYm05clVuQlJVM2ROWVRoeVNtdzBkVzFsWkRobllUVkxTbTB2VWk5TmRtOXlXbEJ6TmpKRlJXdzNjVlIxTW5OR1kybDNVVVZRUWpWMFlXcHJXbGs1Vm1WS2FGTXhRVTVJUVhSamRsRlJQVDBpTENKaGJYSWlPbHNpY0hka0lpd2liV1poSWwwc0ltRndjRjlrYVhOd2JHRjVibUZ0WlNJNklrOXVaU0JQZFhSc2IyOXJJRmRsWWlJc0ltRndjR2xrSWpvaU9URTVPV0ptTWpBdFlURXpaaTAwTVRBM0xUZzFaR010TURJeE1UUTNPRGRsWmpRNElpd2lZWEJ3YVdSaFkzSWlPaUl3SWl3aVkyRndiMnhwWkhOZmJHRjBaV0pwYm1RaU9sc2lZbVpqTnpObU9URXROMlF6WlMwME1ERTJMVGswWTJNdE1qTTBZMkV3TW1NM01USXpJbDBzSW1WdVpuQnZiR2xrY3lJNlcxMHNJbVpoYldsc2VWOXVZVzFsSWpvaVRtZDFlV1Z1SWl3aVoybDJaVzVmYm1GdFpTSTZJbFJvWVdrZ1IybGhJRTVuWVc0aUxDSnBaSFI1Y0NJNkluVnpaWElpTENKcGNHRmtaSElpT2lJeExqRTBOaTR4T1RNdU1USTFJaXdpYkc5bmFXNWZhR2x1ZENJNklrOHVRMmxSTlU1cVVUVlBWMWsxVFZNd2VscEVaR3hNVkZKb1QxZEZkRTlFWXpKUFV6QTBUVVJOTVUxRVFtcFpha1Y2V1RKVlUwcEVWbWhPZWxGM1dUSlJNMHhVVlROT2FtZDBUa2RSZDA5VE1XaGFWRVY2VEZkWk0wMUVXbWxOUkd4dFdWUkplVmw0YjJWTmFrbDVUbFJyTUU5VWJFRmpNMUl4V2tkV2RXUkROV3BrV0Vvd1lWYzBkVnBYVWpGTWJVWXhTVUZyUFNJc0ltNWhiV1VpT2lKVWFHRnBJRWRwWVNCT1oyRnVJRTVuZFhsbGJpQW9VM1IxWkdWdWRDa2lMQ0p2YVdRaU9pSTVOalE1T1dZNU1TMHpaRGRsTFRSaE9XRXRPRGMyT1MwNE1ETTFNREJqWWpFelkyVWlMQ0p2Ym5CeVpXMWZjMmxrSWpvaVV5MHhMVFV0TWpFdE1UVTNOVFk1TmpBMk55MHlOekkzT1RjMk9UTTRMVE13TXpjMk9URTVNRGN0TmpnMU5UWTBJaXdpY0hWcFpDSTZJakV3TURNeU1EQTBORE5DTkRFd1JUWWlMQ0p5YUNJNklqRXVRVlZGUVRGM2VEQlhiV2hZUTFVeWRVVmZZMGR6U2kxcFRFRkpRVUZCUVVGQlVFVlFlbWRCUVVGQlFVRkJRVVJ6UVU1NFFrRkJMaUlzSW5OamNDSTZJa0Z1WVd4NWRHbGpjeTVTWldGa1YzSnBkR1VnUTJGc1pXNWtZWEp6TGxKbFlXUlhjbWwwWlNCRFlXeGxibVJoY25NdVVtVmhaRmR5YVhSbExrRnNiQ0JEWVd4bGJtUmhjbk11VW1WaFpGZHlhWFJsTGxOb1lYSmxaQ0JEWVd4bGJtUmhjbk10U1c1MFpYSnVZV3d1VW1WaFpGZHlhWFJsSUVOb1lXNXVaV3d1UTNKbFlYUmxJRU5vWVc1dVpXd3VVbVZoWkVKaGMybGpMa0ZzYkNCRGFHRnVibVZzVFdWdFltVnlMbEpsWVdRdVFXeHNJRU5vWVc1dVpXeE5aVzFpWlhJdVVtVmhaRmR5YVhSbExrRnNiQ0JEYUdGdWJtVnNUV1Z6YzJGblpTNVNaV0ZrTGtGc2JDQkRhR0YwTGxKbFlXUWdRMmhoZEM1U1pXRmtWM0pwZEdVdVFXeHNJRU52Ykd4aFlpMUpiblJsY201aGJDNVNaV0ZrVjNKcGRHVWdRMjl1Ym1WamRHVmtRV05qYjNWdWRDMUpiblJsY201aGJDNVNaV0ZrVjNKcGRHVWdRMjl1Ym1WamRHOXljeTVTWldGa1YzSnBkR1V1VTJoaGNtVmtJRU52Ym5SaFkzUnpMbEpsWVdSWGNtbDBaU0JEYjI1MFlXTjBjeTVTWldGa1YzSnBkR1V1VTJoaGNtVmtJRVJwY21WamRHOXllUzVTWldGa0xrZHNiMkpoYkNCRWFYSmxZM1J2Y25rdVVtVmhaQzVNYjJOaGJDQkVWMFZ1WjJsdVpTMUpiblJsY201aGJDNVNaV0ZrSUVWQlV5NUJZMk5sYzNOQmMxVnpaWEl1UVd4c0lFWnBiR1Z6TGxKbFlXUlhjbWwwWlM1QmJHd2dSbWxzWlhNdVVtVmhaRmR5YVhSbExsTm9ZWEpsWkNCR2IyTjFjMlZrU1c1aWIzZ3RTVzUwWlhKdVlXd3VVbVZoWkZkeWFYUmxJRWR5YjNWd0xsSmxZV1JYY21sMFpTNUJiR3dnUjNKdmRYQXVVbVZoWkZkeWFYUmxMa0ZzYkM1VFpIQWdURzlqWVhScGIyNXpMVWx1ZEdWeWJtRnNMbEpsWVdSWGNtbDBaU0JOWVdsc0xsSmxZV1JYY21sMFpTQk5ZV2xzTGxKbFlXUlhjbWwwWlM1QmJHd2dUV0ZwYkM1U1pXRmtWM0pwZEdVdVUyaGhjbVZrSUUxaGFXd3VVMlZ1WkNCTllXbHNMbE5sYm1RdVUyaGhjbVZrSUUxaGFXeGliM2hUWlhSMGFXNW5jeTVTWldGa1YzSnBkR1VnVFdGcGJHSnZlRk5sZEhScGJtZHpMbEpsWVdSWGNtbDBaUzVCYkd3Z1RtOTBaWE11VW1WaFpDQk9iM1JsY3k1U1pXRmtWM0pwZEdVZ1RtOTBaWE10U1c1MFpYSnVZV3d1VW1WaFpGZHlhWFJsSUU1dmRHbG1hV05oZEdsdmJuTXRTVzUwWlhKdVlXd3VVbVZoWkZkeWFYUmxJRTl1YkdsdVpVMWxaWFJwYm1kekxsSmxZV1JYY21sMFpTQlBkWFJzYjI5clEyOXdhV3h2ZEMxSmJuUmxjbTVoYkM1U1pXRmtWM0pwZEdVZ1QzVjBiRzl2YTBOdmNHbHNiM1JNYVdObGJuTmxMVWx1ZEdWeWJtRnNMbEpsWVdRdVUyUndJRTkxZEd4dmIydFRaWEoyYVdObExrRmpZMlZ6YzBGelZYTmxjaTVCYkd3Z1QzVjBiRzl2YTFObGNuWnBZMlV1VG05MGFXWnBZMkYwYVc5dWMwTm9ZVzV1Wld3dVFXeHNJRTlYUVM1QlkyTmxjM05CYzFWelpYSXVRV3hzSUZCbGIzQnNaUzVTWldGa0lGQmxiM0JzWlM1U1pXRmtWM0pwZEdVZ1VHVnZjR3hsVUhKbFpHbGpkR2x2Ym5NdFNXNTBaWEp1WVd3dVVtVmhaQ0JRWlc5d2JHVlRaWFIwYVc1bmN5NVNaV0ZrTGtGc2JDQlFiR0ZqWlM1U1pXRmtMa0ZzYkNCUWJHRmpaUzVTWldGa1YzSnBkR1V1UVd4c0lGQnZiR2xqZVM1U1pXRmtMa0ZzYkM1VFpIQWdVSEpsYldsMWJTMUpiblJsY201aGJDNVNaV0ZrVjNKcGRHVWdVSEpwZG1sc1pXZGxMazl3Wlc1QmMxTjVjM1JsYlNCVGFXZHVZV3d1VW1WaFpGZHlhWFJsSUZOcFoyNWhiSE11VW1WaFpDQlRhV2R1WVd4ekxsSmxZV1JYY21sMFpTQlRhV2R1WVd4ekxVbHVkR1Z5Ym1Gc0xsSmxZV1F1VTJoaGNtVmtJRk5wWjI1aGJITXRTVzUwWlhKdVlXd3VVbVZoWkZkeWFYUmxMbE5vWVhKbFpDQlRkV0p6ZEhKaGRHVlRaV0Z5WTJndFNXNTBaWEp1WVd3dVVtVmhaRmR5YVhSbElGUmhaM011VW1WaFpGZHlhWFJsSUZSaGFXeHZjbVZrUlhod1pYSnBaVzVqWlhNdFNXNTBaWEp1WVd3dVVtVmhaRmR5YVhSbElGUmhjMnR6TGxKbFlXUlhjbWwwWlNCVVlYTnJjeTVTWldGa1YzSnBkR1V1VTJoaGNtVmtJRlJsWVcwdVVtVmhaRUpoYzJsakxrRnNiQ0JVYjJSdkxVbHVkR1Z5Ym1Gc0xsSmxZV1JYY21sMFpTQlZjMlZ5TGtsdWRtbDBaUzVCYkd3dVUyUndJRlZ6WlhJdVVtVmhaQzVCYkd3Z1ZYTmxjaTVTWldGa0xsTmtjQ0JWYzJWeUxsSmxZV1JDWVhOcFl5QlZjMlZ5TGxKbFlXUkNZWE5wWXk1QmJHd2dWWE5sY2k1U1pXRmtRbUZ6YVdNdVUyaGhjbVZrSUZWelpYSXVVbVZoWkZkeWFYUmxJRlZ6WlhJdVVtVmhaRmR5YVhSbExsTm9ZWEpsWkNCVmMyVnlMVWx1ZEdWeWJtRnNMbEpsWVdSWGNtbDBaU0lzSW5ObFkyRjFaQ0k2ZXlKaGRXUWlPaUl3TURBd01EQXdNeTB3TURBd0xUQXdNREF0WXpBd01DMHdNREF3TURBd01EQXdNREFpTENKelkzQWlPaUpIY205MWNDNVNaV0ZrVjNKcGRHVXVRV3hzSUZCdmJHbGplUzVTWldGa0xrRnNiQ0JWYzJWeUxsSmxZV1FnVlhObGNpNUpiblpwZEdVdVFXeHNJRXhwWTJWdWMyVkJjM05wWjI1dFpXNTBMbEpsWVdRdVFXeHNJbjBzSW5OcFpDSTZJakF3WVdJell6QTVMV05oT0dZdE0yUmhNaTAxWldWbUxUZ3daVFptTkdKak5XVXpZU0lzSW5OcFoyNXBibDl6ZEdGMFpTSTZXeUpyYlhOcElsMHNJbk4xWWlJNkluUXhha3RoUW1wSVpUSldSak5mVms1QlkwUm9Ta1pRZURGVFZYZEdUR3A1TUZsMFoxa3hZMlJWUlhjaUxDSjBaVzVoYm5SZmNtVm5hVzl1WDNOamIzQmxJam9pVDBNaUxDSjBhV1FpT2lJMVlUYzBNR05rTnkwMU56WTRMVFJrTURrdFlXVXhNeTFtTnpBMllqQTVabUV5TW1NaUxDSjFibWx4ZFdWZmJtRnRaU0k2SWpJeU1qVTVORGs1UUhOMGRXUmxiblF1WTNWeWRHbHVMbVZrZFM1aGRTSXNJblZ3YmlJNklqSXlNalU1TkRrNVFITjBkV1JsYm5RdVkzVnlkR2x1TG1Wa2RTNWhkU0lzSW5WMGFTSTZJa3B2YmkxNGRtWjRhRlZoV2sxRGJWQjROakpCUVZFaUxDSjJaWElpT2lJeExqQWlMQ0ozYVdSeklqcGJJbUkzT1daaVpqUmtMVE5sWmprdE5EWTRPUzA0TVRRekxUYzJZakU1TkdVNE5UVXdPU0pkTENKNGJYTmZZV04wWDJaamRDSTZJalVnTXlJc0luaHRjMTloZFdSZlozVnBaQ0k2SWpBd01EQXdNREF5TFRBd01EQXRNR1ptTVMxalpUQXdMVEF3TURBd01EQXdNREF3TUNJc0luaHRjMTlqWXlJNld5SkRVREVpWFN3aWVHMXpYMlowWkNJNkltOXphV1ZtVkU1R00weHdUV3hGTlZkSlJ6ZDVNVXByYkdwWFNFZENZMFk1VDB4WlkwVkRURzVZT0dkQ1dWaFdlbVJJU21oaVIyeG9XbGRHZW1SRE1XdGpNakY2SWl3aWVHMXpYMmxrY21Wc0lqb2lNU0F5T0NJc0luaHRjMTl6YzIwaU9pSXhJaXdpZUcxelgzTjFZbDltWTNRaU9pSTBJRE1pTENKNGJYTmZkRzUwWDJaamRDSTZJaklnTXlKOS5mT2VjVWRIeUZmbTNnS2JFb2R4eC1DNWxPRkF1dnZ2LUhIOWJIWk51X2g1emI5NzFNcHVhMjRkTmdjeTB2OE9zalBKRUdZb3hnbUFOdm03LV9GVFVkNjBRU2hjdU5aN1Z6a1VXWkx4dlV0VVNzZXpyNnVqY2dKbG13amhFbFFWZTBTRG1ONGNacC1RdTJUdlRGd0N0QXVubFV2b2lKNHlzTktDR2pGX1VVUGRWSjZKTWs5cU9vTEpEZzlBeHdHamdYUFJScFJPZjdkdmVIcVhBZXlaTTF4NWpHcnUyZnJreTc0U29aazZiNmxDMkJFeFQ3endHc0x1ZURYLVNGQll2bzFMbWxxZVFsc3ZBWC04TUZHOGNoUXpSOURSNjFldkxlNGRvMGc0bmZwS3BOU19uZHZtdTR6U0NKUGRiZVpuc2ZieEd5aVkxaXhSaVJTTnRZVVZSNWciLCJlcGsiOiJ7XCJrdHlcIjpcIlJTQVwiLFwiblwiOlwieVNkblMyVGwwaElXeTBDN2JnaVdoM0tGRWFIRWx4U3BYRjRjaGYxcHZxZWZhbzVDN3NDaEx0aXZIY18tcVA1aDdhRlprYnJudVZ5RV9xN2xwTVlpVzVtbmpkbXV3STZmRXc4dGhReHViV21uWjlHRGJEQzNaQnlVa1ZaNGRKX3RsYmdQc2I1bkwtYk1McUdvaWRZU1VkcDZZZUZEc1ZGOWhOWnZaZ0dTTFVTdENRdmFKQWp0S0p6QzMxYUxfS3BiczRPanF5VXJRbmROMkFNZnEyb1U5bk1vb1BWSGpMSUg2VkRJVjZZXzYwT2lXSU9mRV82Q01LR3I1QjRIdjJreVBTSDVVYVU5bzBDMFJpMFdoM0c1bF8ydmEwTGZ0V3E5TWdDVFhZLXRkVi1IYU9rbTNyYnVtelFIYTgtNkx3dVJ2cUR0U1R6OG0xN0FMYlo2TUQ2N2lRXCIsXCJlXCI6XCJBUUFCXCIsXCJhbGdcIjpcIlJTMjU2XCIsXCJleHBcIjpcIjE3NjQ5MzI3NTVcIixcImV4cF9kaWZmXCI6XCI4NjQwMFwiLFwia2lkXCI6XCJrcC1jbGtxWVZSejFzdGNZZmEtZWxra21MM0VcIn0uS2RvRzBPYnFMQ0dRQnZKeXcvMndyeVp3YWRDT004WDQ5L0xQcStUek1vZHRtQXphV3U5MjVsaW16UWlUM0o1TXJCQWpiTmxZR0tyQVJwZTJ5VEhzSU82YWRsQXpINytLU1JiUUhZQXJJV1R5djh2ZVI3NFNCSDczZG02OTAxeForRU9qUkV0N09HK05lczZjOTFIUDNmcXVmRDdnVHNYY205Vm90U2gwWEdWSUZGT05kc3Yycnp4cXEwRlRsQlRKb1cvL2lnMnNUTWxXNS96V0t6cCt0c1JBakwzY0RSclAycVZtTThnSHFFdWdyWDZ2cW92c2lQWXBMcnBEOUJTOGQ5UFRuKzUwUmFVOG1mU0FXTlZBZVc2a1ZNMzRSak9ZcWZ2V2h5alZld2hXRm1tYmtDc1h4ZGhCNVdEbjYwUnR2dHZtdEo0TjhlTStWSk9Mb0s4WEtBPT0iLCJuYmYiOjE3NjQ4NDMzMTMsImV4cCI6MTc2NDg0MzYxMywiaXNzIjoiaHR0cHM6Ly9zdWJzdHJhdGUub2ZmaWNlLmNvbS9zdHMvIiwiYXVkIjoiaHR0cHM6Ly9vdXRsb29rLm9mZmljZS5jb20iLCJzc2VjIjoiRTdUTTNmQTc2dGxIQmpDZSIsImVzc2VjIjoiYXJ0aWZhY3QtYXV0by1wcm9kfE0zNjUyMDI1LTA4LTIzVDIyOjE0OjQ2Ljg4ODU3MjRafEhhOTMrOThmWWhzaEtmIn0.RBb6WZNcYJfr9CevDZTKdLFTkBH1f7oq_9DmD9CGI0tq1ybmJAvLQhdH2XEQDpEJX9kYXGz2KjQzyvsCP974XZuUEq4ilJ9m3qcKTUS9pOOzKM_2IMpAbThKqB4dvb5KqVRDfX3Fagu1qjtdeztgkbA1NYiN-9Y5SfudQogZJDsTssiVyM0356J_IQd43jFyLxTjU_v3C4taPjok_-GEUqmbpEMLT_acmpmFnaEkcDmr8IBus3b91pZBnl_yak3i62vwnF3FDt9IHGC9e-uNmLekWPPiP7rMBQl3e-Z7Kvwkn-o6JXJlLLp41Jfx9ROsdaJVC3KzYnqrkjQ8TYZedQ&X-OWA-CANARY=X-OWA-CANARY_cookie_is_null_or_empty&owa=outlook.office.com&scriptVer=20251114001.21&clientId=F63AFA8FA78345AC8DF3183E6E0BE90B&animation=true?w=800&auto=format&fit=crop&q=60"] 
  },
  { 
  id: 2, title: "Vulnerable Machines CTF", date: "JULY 2025", category: "Document",   
  ov: "Overview", 
  challenge: "CHALLENGE", 
  challenge_content: "...", 
  solution: "SOLUTION", 
  solution_content: "..." , 
  tech: "TECHNICAL ARCHITECTURE", 
  tech_content: "...", 
  feature: "KEY FEATURES", 
  feature_content: "...", 
  design: "USER EXPERIENCE DESIGN", 
  design_content: "...", 
  perf: "PERFORMANCE", 
  perf_content: "...", 
  result: "OUTCOMES", 
  result_content: "...", 
  future: "FUTURE ENHANCEMENTS", 
  future_content: "...", 
  conclusion: "Conclusion", 
  images: ["..."] 
  },
  { 
  id: 3, title: "Cross Site Request Forgery", date: "OCTOBER 2025", category: "Simulation", 
  ov: "Overview", 
  challenge: "CHALLENGE", 
  challenge_content: "...", 
  solution: "SOLUTION", 
  solution_content: "..." , 
  tech: "TECHNICAL ARCHITECTURE", 
  tech_content: "...", 
  feature: "KEY FEATURES", 
  feature_content: "...", 
  design: "USER EXPERIENCE DESIGN", 
  design_content: "...", 
  perf: "PERFORMANCE", 
  perf_content: "...", 
  result: "OUTCOMES", 
  result_content: "...", 
  future: "FUTURE ENHANCEMENTS", 
  future_content: "...", 
  conclusion: "Conclusion", 
  images: ["..."] 
  },
  { 
  id: 4, title: "EcoPulse Microgrid Dashboard", date: "SEPTEMBER 2025", category: "Simulation", 
  ov: "Overview", 
  challenge: "CHALLENGE", 
  challenge_content: "...", 
  solution: "SOLUTION", 
  solution_content: "..." , 
  tech: "TECHNICAL ARCHITECTURE", 
  tech_content: "...", 
  feature: "KEY FEATURES", 
  feature_content: "...", 
  design: "USER EXPERIENCE DESIGN", 
  design_content: "...", 
  perf: "PERFORMANCE", 
  perf_content: "...", 
  result: "OUTCOMES", 
  result_content: "...", 
  future: "FUTURE ENHANCEMENTS", 
  future_content: "...", 
  conclusion: "Conclusion", 
  images: ["..."] 
  },
  { 
  id: 5, title: "Portfolio", date: "NOVEMBER 2025", category: "Web Design", 
  ov: "Overview", 
  challenge: "CHALLENGE", 
  challenge_content: "...", 
  solution: "SOLUTION", 
  solution_content: "..." , 
  tech: "TECHNICAL ARCHITECTURE", 
  tech_content: "...", 
  feature: "KEY FEATURES", 
  feature_content: "...", 
  design: "USER EXPERIENCE DESIGN", 
  design_content: "...", 
  perf: "PERFORMANCE", 
  perf_content: "...", 
  result: "OUTCOMES", 
  result_content: "...", 
  future: "FUTURE ENHANCEMENTS", 
  future_content: "...", 
  conclusion: "Conclusion", 
  images: ["..."] 
  },
  {
  id: 6, title: "Heart Dry with Thirst", date: "November 2025", category: "Game", 
  ov: "Overview", 
  challenge: "CHALLENGE", 
  challenge_content: "...", 
  solution: "SOLUTION", 
  solution_content: "..." , 
  tech: "TECHNICAL ARCHITECTURE", 
  tech_content: "...", 
  feature: "KEY FEATURES", 
  feature_content: "...", 
  design: "USER EXPERIENCE DESIGN", 
  design_content: "...", 
  perf: "PERFORMANCE", 
  perf_content: "...", 
  result: "OUTCOMES", 
  result_content: "...", 
  future: "FUTURE ENHANCEMENTS", 
  future_content: "...", 
  conclusion: "Conclusion", 
  images: ["..."]
  },
  { 
  id: 7, title: "Photography Zine", date: "COMING SOON", category: "Photography", 
  ov: "Overview", 
  challenge: "CHALLENGE", 
  challenge_content: "...", 
  solution: "SOLUTION", 
  solution_content: "..." , 
  tech: "TECHNICAL ARCHITECTURE", 
  tech_content: "...", 
  feature: "KEY FEATURES", 
  feature_content: "...", 
  design: "USER EXPERIENCE DESIGN", 
  design_content: "...", 
  perf: "PERFORMANCE", 
  perf_content: "...", 
  result: "OUTCOMES", 
  result_content: "...", 
  future: "FUTURE ENHANCEMENTS", 
  future_content: "...", 
  conclusion: "Conclusion", 
  images: ["..."] 
  },
  {
  id: 8, title: "Timeline", date: "COMING SOON", category: "Game", 
  ov: "Overview", 
  challenge: "CHALLENGE", 
  challenge_content: "...", 
  solution: "SOLUTION", 
  solution_content: "..." , 
  tech: "TECHNICAL ARCHITECTURE", 
  tech_content: "...", 
  feature: "KEY FEATURES", 
  feature_content: "...", 
  design: "USER EXPERIENCE DESIGN", 
  design_content: "...", 
  perf: "PERFORMANCE", 
  perf_content: "...", 
  result: "OUTCOMES", 
  result_content: "...", 
  future: "FUTURE ENHANCEMENTS", 
  future_content: "...", 
  conclusion: "Conclusion", 
  images: ["..."]
  },
];

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
