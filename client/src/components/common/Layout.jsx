import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationDropdown from '../NotificationDropdown';
import LanguageSwitcher from '../LanguageSwitcher';
import SyncRequestModal from '../sync/SyncRequestModal';
import { useSyncContext } from '../../context/SyncContext';
import { authService } from '../../services/authService';
import { FiMenu, FiX, FiPackage, FiMaximize2, FiShield, FiUser, FiEdit2 } from 'react-icons/fi';

const Layout = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = authService.getCurrentUser();

  // ── All sync state from context ──
  const {
    pendingSyncRequests,
    activeSyncRequest,
    minimizedIds,
    acceptSyncRequest,
    rejectSyncRequest,
    minimizeSyncRequest,
    expandSyncRequest
  } = useSyncContext();

  // Requests shown as pills in navbar (everything except the active full modal)
  const trayRequests = pendingSyncRequests.filter(r => r._id !== activeSyncRequest?._id);
  const isActiveMinimized = activeSyncRequest && minimizedIds.has(activeSyncRequest._id);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // ── Header center content ──
  // Priority: active minimized pill → tray pills → normal title
  const renderHeaderCenter = () => {
    // Case 1: Active request is minimized — show it as the primary pill
    if (activeSyncRequest && isActiveMinimized) {
      const isEdit = activeSyncRequest.syncType === 'edit';
      return (
        <div className="flex items-center gap-2">
          {/* Active minimized pill */}
          <button
            onClick={() => expandSyncRequest(activeSyncRequest._id)}
            className={`flex items-center gap-3 px-4 py-2 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 ${
              isEdit
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-yellow-400 to-orange-500 animate-pulse-gentle'
            }`}
          >
            {isEdit ? <FiEdit2 className="text-xl" /> : <FiPackage className="text-xl" />}
            <div className="text-left">
              <div className="text-sm font-bold">
                {isEdit ? 'Edit Request Pending' : 'Sync Request Pending'}
              </div>
              <div className="text-xs opacity-90">
                {activeSyncRequest.metadata?.orderChallanNumber || 'N/A'} - Click to review
              </div>
            </div>
            <FiMaximize2 className="text-lg ml-2" />
          </button>

          {/* Additional tray pills beside it */}
          {trayRequests.map(req => {
            const isEditReq = req.syncType === 'edit';
            const isNew = (Date.now() - new Date(req.syncedAt).getTime()) < 5 * 60 * 1000;
            return (
              <button
                key={req._id}
                onClick={() => expandSyncRequest(req._id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all hover:shadow-md ${
                  isEditReq
                    ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                    : 'bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100'
                }`}
              >
                {isNew && (
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEditReq ? 'bg-amber-400' : 'bg-blue-400'}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isEditReq ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  </span>
                )}
                {isEditReq ? <FiEdit2 size={13} /> : <FiPackage size={13} />}
                <span className="max-w-[100px] truncate">
                  {req.metadata?.orderChallanNumber || req._id.toString().slice(-6)}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                  isEditReq ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'
                }`}>
                  {isEditReq ? 'EDIT' : 'NEW'}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    // Case 2: No active modal open, but there are other pending pills in tray
    if (trayRequests.length > 0) {
      return (
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800 mr-2">GarmentFlow System</h1>
          {trayRequests.map(req => {
            const isEditReq = req.syncType === 'edit';
            const isNew = (Date.now() - new Date(req.syncedAt).getTime()) < 5 * 60 * 1000;
            return (
              <button
                key={req._id}
                onClick={() => expandSyncRequest(req._id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all hover:shadow-md ${
                  isEditReq
                    ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                    : 'bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100'
                }`}
              >
                {isNew && (
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEditReq ? 'bg-amber-400' : 'bg-blue-400'}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isEditReq ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  </span>
                )}
                {isEditReq ? <FiEdit2 size={13} /> : <FiPackage size={13} />}
                <span className="max-w-[100px] truncate">
                  {req.metadata?.orderChallanNumber || req._id.toString().slice(-6)}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                  isEditReq ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'
                }`}>
                  {isEditReq ? 'EDIT' : 'NEW'}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    // Case 3: Nothing pending — normal title
    return <h1 className="text-xl font-bold text-gray-800">GarmentFlow System</h1>;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>

            {/* Dynamic center content */}
            {renderHeaderCenter()}
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell 
            <NotificationDropdown />*/}
            <LanguageSwitcher />

            {/* User Info with Role */}
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                user?.role === 'admin'
                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                  : 'bg-gradient-to-br from-blue-500 to-cyan-600'
              }`}>
                {user?.role === 'admin' ? (
                  <FiShield className="text-white text-sm" />
                ) : (
                  <FiUser className="text-white text-sm" />
                )}
              </div>
              <div className="text-right">
                <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold ${
                  user?.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {user?.role === 'admin' ? 'Admin' : 'Sales'}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-semibold text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Global Sync Request Modal — only shown when active and NOT minimized */}
      {activeSyncRequest && !minimizedIds.has(activeSyncRequest._id) && (
        <SyncRequestModal
          syncRequest={activeSyncRequest}
          onAccept={acceptSyncRequest}
          onReject={rejectSyncRequest}
          onMinimize={() => minimizeSyncRequest(activeSyncRequest._id)}
        />
      )}
    </div>
  );
};

export default Layout;
