import { FiUser, FiLogOut, FiBell } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import toast from 'react-hot-toast';
import NotificationDropdown from '../NotificationDropdown';
import { useEditSession } from '../../hooks/useEditSession';

const Navbar = ({ user, setUser }) => {
  const navigate = useNavigate();
   const { hasActiveSession, remainingChanges, timeLeft } = useEditSession();

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <nav className="h-[70px] bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-[100] shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Cargo Inventory System</h1>
      </div>
      
      <div className="flex items-center gap-6">
        {/* NOTIFICATION BELL - ADD THIS */}
        <NotificationDropdown />

        {/* ✅ ADD SESSION INDICATOR */}
        {hasActiveSession && (
          <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 border border-green-300 rounded-full">
            <span className="text-xs font-medium text-green-800">
              ✏️ {remainingChanges} edits
            </span>
            {timeLeft && (
              <span className={`text-xs font-bold ${
                timeLeft.totalSeconds < 60 ? 'text-red-600 animate-pulse' : 'text-green-600'
              }`}>
                {timeLeft.minutes}:{String(timeLeft.seconds).padStart(2, '0')}
              </span>
            )}
          </div>
        )}

        
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-100">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600">{user?.email}</p>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-all"
        >
          <FiLogOut />
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
