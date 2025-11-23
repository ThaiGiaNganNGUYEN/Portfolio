import React, { useState, useEffect, useRef } from 'react';
import { Instagram, Twitter, Mail, ArrowRight, ArrowLeft, X, Download, ExternalLink, Menu, ChevronLeft, ChevronRight, Linkedin, Github, MessageCircle } from 'lucide-react';

// --- UTILITY: DYNAMIC SCRIPT LOADER (For Matter.js) ---
const useScript = (url) => {
  const [status, setStatus] = useState(url ? "loading" : "idle");
  useEffect(() => {
    if (!url) {
      setStatus("idle");
      return;
    }
    let script = document.querySelector(`script[src="${url}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.setAttribute("data-status", "loading");
      document.body.appendChild(script);
      const setAttributeFromEvent = (event) => {
        script.setAttribute(
          "data-status",
          event.type === "load" ? "ready" : "error"
        );
        setStatus(event.type === "load" ? "ready" : "error");
      };
      script.addEventListener("load", setAttributeFromEvent);
      script.addEventListener("error", setAttributeFromEvent);
    } else {
      setStatus(script.getAttribute("data-status"));
    }
    const setStateFromEvent = (event) => {
      setStatus(event.type === "load" ? "ready" : "error");
    };
    script.addEventListener("load", setStateFromEvent);
    script.addEventListener("error", setStateFromEvent);
    return () => {
      if (script) {
        script.removeEventListener("load", setStateFromEvent);
        script.removeEventListener("error", setStateFromEvent);
      }
    };
  }, [url]);
  return status;
};

// --- COMPONENT: LANYARD (Physics Simulation) ---
const Lanyard = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const scriptStatus = useScript("https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js");

  useEffect(() => {
    if (scriptStatus !== "ready" || !containerRef.current || !canvasRef.current) return;

    // Matter.js module aliases
    const Matter = window.Matter;
    const Engine = Matter.Engine,
          Render = Matter.Render,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Composite = Matter.Composite,
          Constraint = Matter.Constraint,
          Mouse = Matter.Mouse,
          MouseConstraint = Matter.MouseConstraint,
          Events = Matter.Events;

    // Create engine
    const engine = Engine.create();
    const world = engine.world;

    // Dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Create renderer
    const render = Render.create({
      element: containerRef.current,
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width,
        height,
        background: 'transparent',
        wireframes: false,
        pixelRatio: window.devicePixelRatio
      }
    });

    // --- PHYSICS OBJECTS ---
   
    // The Card (Body)
    const cardWidth = 180;
    const cardHeight = 260;
    const cardBody = Bodies.rectangle(width / 2, height / 2 + 100, cardWidth, cardHeight, {
      chamfer: { radius: 10 },
      density: 0.002,
      frictionAir: 0.02,
      restitution: 0.0, // No bounce
      render: {
        fillStyle: '#ffffff',
        strokeStyle: '#000000',
        lineWidth: 2
      }
    });

    // The Chain (String)
    const segments = 10;
    const startY = 0;
    const segmentHeight = 15;
   
    const group = Matter.Body.nextGroup(true);
   
    // Create rope segments
    const rope = Matter.Composites.stack(width / 2, startY, 1, segments, 0, 10, (x, y) => {
        return Bodies.rectangle(x, y, 4, segmentHeight, {
            collisionFilter: { group: group },
            render: { fillStyle: '#111' },
            frictionAir: 0.05
        });
    });
   
    // Connect rope segments
    Matter.Composites.chain(rope, 0, 0.5, 0, -0.5, {
        stiffness: 1,
        damping: 0.2,
        render: { type: 'line', strokeStyle: '#111', lineWidth: 2 }
    });

    // Anchor point (Top of screen)
    const anchor = Bodies.circle(width / 2, -20, 20, { isStatic: true, render: { visible: false } });

    // Connect Anchor to Rope
    const anchorConstraint = Constraint.create({
        bodyA: anchor,
        bodyB: rope.bodies[0],
        pointB: { x: 0, y: -segmentHeight/2 },
        stiffness: 0.8,
        length: 0,
        render: { visible: false }
    });

    // Connect Rope to Card
    const cardConstraint = Constraint.create({
        bodyA: rope.bodies[rope.bodies.length - 1],
        bodyB: cardBody,
        pointA: { x: 0, y: segmentHeight/2 },
        pointB: { x: 0, y: -cardHeight / 2 + 10 }, // Attach near top of card
        stiffness: 0.8,
        length: 10,
        render: { strokeStyle: '#111', lineWidth: 2 }
    });

    Composite.add(world, [cardBody, rope, anchor, anchorConstraint, cardConstraint]);

    // --- MOUSE CONTROL ---
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.1,
            render: { visible: false }
        }
    });
    Composite.add(world, mouseConstraint);
    render.mouse = mouse;

    // --- RENDERING TEXT ON CARD (Simulating Content) ---
    Events.on(render, 'afterRender', () => {
        const ctx = render.context;
        const { position, angle } = cardBody;

        ctx.translate(position.x, position.y);
        ctx.rotate(angle);

        // Card styling
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("YOUR NAME", 0, -60);
       
        ctx.font = "10px Inter, sans-serif";
        ctx.fillText("CREATIVE DEV", 0, -40);

        // Fake Photo Placeholder
        ctx.fillStyle = "#e5e5e5";
        ctx.fillRect(-40, -20, 80, 80);
        ctx.strokeStyle = "#000";
        ctx.strokeRect(-40, -20, 80, 80);
       
        // Barcode lines at bottom
        ctx.fillStyle = "#000";
        ctx.fillRect(-60, 90, 120, 10);
        ctx.fillRect(-60, 105, 120, 4);

        ctx.rotate(-angle);
        ctx.translate(-position.x, -position.y);
    });

    // Run engine
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    // Handle resize
    const handleResize = () => {
        if (!containerRef.current) return;
        const newWidth = containerRef.current.clientWidth;
        render.canvas.width = newWidth;
        render.options.width = newWidth;
        // Re-center anchor
        Matter.Body.setPosition(anchor, { x: newWidth / 2, y: -20 });
    };
    window.addEventListener('resize', handleResize);

    return () => {
        Render.stop(render);
        Runner.stop(runner);
        Engine.clear(engine);
        render.canvas.remove();
        render.canvas = null;
        render.context = null;
        render.textures = {};
        window.removeEventListener('resize', handleResize);
    };
  }, [scriptStatus]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#f3f3f3] relative overflow-hidden cursor-grab active:cursor-grabbing border-b md:border-b-0 md:border-r border-black">
        <canvas ref={canvasRef} className="block" />
        <div className="absolute bottom-6 left-0 w-full text-center pointer-events-none">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Drag to Interact</p>
        </div>
    </div>
  );
};

// --- MOCK DATA ---
// Sorted Newest (Index 0) to Oldest (Index N)
const PROJECTS = [
  {
    id: 1,
    title: "E-Commerce Redesign",
    date: "OCTOBER 2024",
    category: "Development",
    description: "A complete overhaul of a high-traffic fashion retailer's digital storefront.",
    content: "This project involved a full migration to a headless architecture using Next.js and Shopify Plus. The goal was to reduce load times by 40% while implementing a brutalist design system requested by the client. We utilized custom WebGL shaders for product transitions and implemented a real-time inventory management system.",
    images: ["https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=60", "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&auto=format&fit=crop&q=60"]
  },
  {
    id: 2,
    title: "AI Chat Interface",
    date: "SEPTEMBER 2024",
    category: "UI/UX Design",
    description: "An intuitive interface for a large language model designed for legal professionals.",
    content: "Designing for trust was the primary challenge. We created a stark, high-contrast interface that emphasizes readability and precision. The system integrates real-time citation checking and a document comparison split-view that allows lawyers to work side-by-side with the AI.",
    images: ["https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=60", "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=60"]
  },
  {
    id: 3,
    title: "Portfolio V1",
    date: "AUGUST 2024",
    category: "Development",
    description: "My previous portfolio exploring isometric layouts.",
    content: "A playground for three.js experiments. The site featured a fully navigable 3D room where visitors could click on objects to reveal project details. While visually striking, user feedback suggested navigation was too abstract, leading to the current brutalist redesign.",
    images: ["https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=60", "https://images.unsplash.com/photo-1550439062-609e1531270e?w=800&auto=format&fit=crop&q=60"]
  },
  {
    id: 4,
    title: "Financial Dashboard",
    date: "JULY 2024",
    category: "Full Stack",
    description: "Real-time crypto analytics dashboard.",
    content: "Built with React, D3.js, and WebSockets. Handles thousands of data points per second without UI lag. The design focuses on data density without clutter, using collapsible panels and customizable widget layouts.",
    images: ["https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60", "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=60"]
  },
];

// --- PAGE COMPONENTS ---

const Home = () => {
  // Styles for the floating animation
  const style = `
    @keyframes floatUp {
      0% { opacity: 0; transform: translateY(20px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .animate-float-up {
      animation: floatUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
    }
  `;

  return (
    <>
      <style>{style}</style>
      <div className="min-h-screen flex flex-col justify-center items-center px-4 md:px-12 py-24 bg-black text-white">
        <div className="w-full max-w-4xl mx-auto text-center">
          <h1
            className="text-5xl md:text-8xl font-bold tracking-widest uppercase mb-8 animate-float-up"
            style={{ animationDelay: '0.1s' }}
          >
            GREY NGUYEN
          </h1>
          <p
            className="text-xs md:text-sm leading-relaxed max-w-3xl mx-auto uppercase tracking-wide text-gray-300 animate-float-up"
            style={{ animationDelay: '0.4s' }}
          >
            THIS IS A SPACE THAT AIMS TO CREATE NEW THINGS THAT ATTRACT ATTENTION IN A DIFFERENT WAY FROM WHAT IS USUAL OR EXPECTED.
          </p>
         
          <div className="animate-float-up" style={{ animationDelay: '0.7s' }}>
            <a href="mailto:contact@oddatelier.net" className="inline-block mt-16 text-xs md:text-sm font-bold uppercase tracking-widest hover:underline">
              NTGNGAN3107@GMAIL.COM
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

const About = () => {
  const [activeTab, setActiveTab] = useState('INTRODUCTION');
  const tabs = ['INTRODUCTION', 'EDUCATION', 'EXPERIENCE', 'EXPERTISE'];

  // Content Rendering
  const renderContent = () => {
    switch (activeTab) {
      case 'INTRODUCTION':
        return (
          <div className="uppercase leading-relaxed text-sm md:text-base font-medium space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p>
              I am a multidisciplinary developer obsessed with the intersection of design and engineering.
              Unlike traditional developers, I view code as a medium for artistic expression.
            </p>
            <p>
              Started coding in 2018, aiming to create new digital experiences that attract attention in a different way from what is usual or expected.
              Focusing on brutalist aesthetics and high-performance interactions.
            </p>
          </div>
        );
      case 'EDUCATION':
        return (
          <div className="uppercase leading-relaxed text-sm md:text-base font-medium space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div>
              <h3 className="font-bold mb-2">University of Technology</h3>
              <p className="text-gray-500">Bachelor of Science in Computer Science</p>
              <p className="text-gray-400 text-xs mt-1">2017 - 2021</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Design Institute</h3>
              <p className="text-gray-500">Certification in Interaction Design</p>
              <p className="text-gray-400 text-xs mt-1">2022</p>
            </div>
          </div>
        );
      case 'EXPERIENCE':
        return (
           <div className="uppercase leading-relaxed text-sm md:text-base font-medium space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div>
              <h3 className="font-bold mb-2">Senior Developer</h3>
              <p className="text-gray-500">Tech Corp • 2023-Present</p>
              <p className="text-sm mt-2">Leading the frontend infrastructure team and developing design systems.</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Creative Technologist</h3>
              <p className="text-gray-500">Design Studio • 2021-2023</p>
              <p className="text-sm mt-2">Built award-winning campaign sites for global fashion brands.</p>
            </div>
          </div>
        );
      case 'EXPERTISE':
        return (
          <div className="uppercase leading-relaxed text-sm md:text-base font-medium animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-2 gap-4">
              <div>
                 <h3 className="font-bold mb-4 border-b border-black pb-2">Development</h3>
                 <ul className="space-y-2 text-gray-600">
                   <li>React / Next.js</li>
                   <li>TypeScript</li>
                   <li>Node.js</li>
                   <li>WebGL / Three.js</li>
                 </ul>
              </div>
              <div>
                 <h3 className="font-bold mb-4 border-b border-black pb-2">Design</h3>
                 <ul className="space-y-2 text-gray-600">
                   <li>UI / UX</li>
                   <li>Motion Design</li>
                   <li>3D Modeling</li>
                   <li>Prototyping</li>
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
      {/* Centered Name Header - Mimicking "JENNIE" */}
      <div className="w-full text-center py-12 pt-32">
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-widest">THAI GIA NGAN (GREY) NGUYEN</h1>
      </div>

      {/* Grid Layout: Lanyard Left, Content Right */}
      <div className="flex-grow w-full grid grid-cols-1 lg:grid-cols-2 border-t border-black">
       
        {/* Left: Lanyard Simulation */}
        <div className="h-[50vh] lg:h-auto w-full bg-[#f3f3f3] relative border-b lg:border-b-0 lg:border-r border-black order-1">
          <Lanyard />
        </div>

        {/* Right: Content Area */}
        <div className="flex flex-col order-2 p-6 md:p-12 h-full relative">
         
          {/* Top: Tab Navigation (Sub-menu) */}
          <div className="flex flex-wrap gap-6 md:gap-8 mb-16 text-[10px] md:text-xs font-bold tracking-widest uppercase">
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
  <div className="min-h-screen bg-white animate-in fade-in duration-500 pt-32 pb-24">
    <div className="max-w-5xl mx-auto px-6 md:px-12">
     
      {/* Close Button */}
      <button onClick={onClose} className="mb-12 flex items-center gap-2 text-xs uppercase tracking-widest font-bold hover:opacity-50 transition-opacity">
        <X size={16} /> Close Project
      </button>

      {/* Article Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-black uppercase leading-tight mb-4">{project.title}</h1>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{project.date}</p>
      </div>

      {/* Main Image */}
      <div className="w-full aspect-video bg-gray-200 mb-16">
         <img src={project.images[0]} alt={project.title} className="w-full h-full object-cover" />
      </div>

      {/* Article Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-24">
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
              </div>
           </div>
        </div>
        <div className="md:col-span-8">
           <p className="text-xl md:text-2xl leading-relaxed font-medium uppercase">{project.description}</p>
           <div className="mt-12 text-base leading-loose text-gray-600 normal-case font-serif">
             {project.content}
           </div>
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

const Projects = () => {
  const [selectedId, setSelectedId] = useState(null);

  // Finding current index based on ID
  const currentIndex = PROJECTS.findIndex(p => p.id === selectedId);

  // Logic:
  // "Next" in UI (Left button) goes to Newer (Index - 1)
  // "Previous" in UI (Right button) goes to Older (Index + 1)
 
  const handleNewer = () => {
    if (currentIndex > 0) {
      setSelectedId(PROJECTS[currentIndex - 1].id);
      window.scrollTo(0, 0);
    }
  };

  const handleOlder = () => {
    if (currentIndex < PROJECTS.length - 1) {
      setSelectedId(PROJECTS[currentIndex + 1].id);
      window.scrollTo(0, 0);
    }
  };

  if (selectedId) {
    const project = PROJECTS.find(p => p.id === selectedId);
    return (
      <ProjectDetail
        project={project}
        onNext={handleOlder} // UI "Previous" -> Logic Older
        onPrev={handleNewer} // UI "Next" -> Logic Newer
        hasNext={currentIndex < PROJECTS.length - 1} // Has Older items
        hasPrev={currentIndex > 0} // Has Newer items
        onClose={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen pt-32 px-6 md:px-12 pb-24">
      {/* NEWS-style Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-16 max-w-[1920px] mx-auto">
        {PROJECTS.map((project) => (
          <div
            key={project.id}
            onClick={() => setSelectedId(project.id)}
            className="group cursor-pointer flex flex-col gap-4"
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
    </div>
  );
};

const Resume = () => (
  <div className="min-h-[85vh] flex flex-col px-6 md:px-12 pt-32">
    <div className="flex justify-between items-end mb-8">
      <h1 className="text-6xl font-black uppercase tracking-tighter">Resume</h1>
      <button className="flex items-center gap-2 bg-black text-white px-6 py-3 text-sm font-bold uppercase hover:bg-gray-800 transition-colors">
        <Download size={16} /> Download PDF
      </button>
    </div>
   
    <div className="flex-grow border-2 border-black bg-gray-100 flex items-center justify-center relative mb-12 group">
       {/* Placeholder for PDF object/iframe */}
       <div className="text-center p-12">
          <div className="w-24 h-32 border border-gray-400 mx-auto mb-4 bg-white shadow-lg flex items-center justify-center">
             <span className="text-[10px] text-gray-400">PDF PREVIEW</span>
          </div>
          <p className="text-lg font-bold uppercase">Resume.pdf</p>
          <p className="text-gray-500 mb-6">Visual preview is simulated for this demo.</p>
          <button className="underline text-sm uppercase tracking-widest hover:text-gray-600">View Full Screen</button>
       </div>
    </div>
  </div>
);

// --- MAIN LAYOUT & APP ---

const App = () => {
  const [activePage, setActivePage] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Reset scroll on page change
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

  const NavLink = ({ page, label, isHome }) => (
    <button
      onClick={() => setActivePage(page)}
      className={`uppercase text-xs md:text-sm font-bold tracking-widest hover:underline decoration-2 underline-offset-4 transition-all text-right
        ${activePage === page ? 'underline' : ''} ${isHome ? 'text-white' : 'text-black'}`}
    >
      {label}
    </button>
  );

  // Determine if we are on the Home page for styling
  const isHome = activePage === 'home';

  return (
    <div className={`min-h-screen font-sans selection:bg-black selection:text-white flex flex-col ${isHome ? 'bg-black' : 'bg-white text-black'}`}>
     
      {/* Header - Adjusted Layout for ODDATELIER style */}
      <header className="fixed top-0 left-0 w-full z-50 h-auto flex items-start justify-between p-6 md:p-8 pointer-events-none">
       
        {/* Left: Profile/Logo - Always Visible */}
        <button onClick={() => setActivePage('home')} className="pointer-events-auto flex items-center gap-4 group">
          <div className={`w-12 h-12 rounded-full overflow-hidden border border-current transition-all duration-500 ${isHome ? 'border-white' : 'border-black'}`}>
             <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=60" alt="Profile" className="w-full h-full object-cover grayscale group-hover:grayscale-0" />
          </div>
        </button>

        {/* Right: Stacked Navigation */}
        <nav className="pointer-events-auto hidden md:flex flex-col gap-1 items-end">
          <NavLink page="home" label="Home" isHome={isHome} />
          <NavLink page="about" label="About" isHome={isHome} />
          <NavLink page="projects" label="Projects" isHome={isHome} />
          <NavLink page="resume" label="Resume" isHome={isHome} />
        </nav>

        {/* Mobile Menu Toggle */}
        <button className={`md:hidden pointer-events-auto ${isHome ? 'text-white' : 'text-black'}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-32 px-6 md:hidden flex flex-col items-end gap-6">
           <NavLink page="home" label="Home" isHome={false} />
           <NavLink page="about" label="About" isHome={false} />
           <NavLink page="projects" label="Projects" isHome={false} />
           <NavLink page="resume" label="Resume" isHome={false} />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow w-full max-w-[1920px] mx-auto">
        {renderPage()}
      </main>

      {/* Footer - Centered for ODDATELIER Look */}
      <footer className={`p-8 md:p-12 mt-auto w-full flex flex-col items-center justify-center gap-6 ${isHome ? 'bg-black text-white' : 'bg-white text-black border-t border-black'}`}>
        <div className="flex gap-8">
            <a href="https://www.linkedin.com/in/thai-gia-ngan-nguyen" className={`transition-opacity hover:opacity-60 ${isHome ? 'text-white' : 'text-black'}`}><Linkedin size={20} /></a>
            <a href="https://github.com/ThaiGiaNganNGUYEN" className={`transition-opacity hover:opacity-60 ${isHome ? 'text-white' : 'text-black'}`}><Github size={20} /></a>
            <a href="https://www.instagram.com/_noirxze_/" className={`transition-opacity hover:opacity-60 ${isHome ? 'text-white' : 'text-black'}`}><Instagram size={20} /></a>
            <a href="#" className={`transition-opacity hover:opacity-60 ${isHome ? 'text-white' : 'text-black'}`}><MessageCircle size={20} /></a>
        </div>
        <div className="text-[10px] uppercase tracking-widest opacity-60">
           <span>© Thai Gia Ngan Nguyen. All Rights Reserved.</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
