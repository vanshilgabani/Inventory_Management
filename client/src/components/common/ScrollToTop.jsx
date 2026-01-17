import { useState, useEffect } from 'react';
import { FiArrowUp } from 'react-icons/fi';

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const mainElement = document.querySelector('main');
    
    if (!mainElement) return;

    const toggleVisibility = () => {
      if (mainElement.scrollTop > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    mainElement.addEventListener('scroll', toggleVisibility);
    return () => mainElement.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className="scroll-to-top-button"
          aria-label="Scroll to top"
        >
          <FiArrowUp className="text-2xl" />
        </button>
      )}

      <style>{`
        .scroll-to-top-button {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          border: none;
          border-radius: 50%;
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
          cursor: pointer;
          z-index: 50;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: gentle-float 3s ease-in-out infinite;
        }

        /* Gentle floating animation - very subtle */
        @keyframes gentle-float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        /* Hover effects */
        .scroll-to-top-button:hover {
          transform: translateY(-5px) scale(1.1);
          box-shadow: 0 12px 30px rgba(99, 102, 241, 0.5);
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
        }

        .scroll-to-top-button:active {
          transform: translateY(-2px) scale(1.05);
        }

        /* Icon animation on hover */
        .scroll-to-top-button:hover svg {
          animation: arrow-bounce 0.8s ease-in-out infinite;
        }

        @keyframes arrow-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        /* Smooth entrance animation */
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .scroll-to-top-button {
          animation: gentle-float 3s ease-in-out infinite, slideInRight 0.4s ease-out;
        }
      `}</style>
    </>
  );
};

export default ScrollToTop;
