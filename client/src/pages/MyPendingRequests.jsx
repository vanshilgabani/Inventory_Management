import { useState, useEffect } from 'react';
import { FiClock, FiCheckCircle, FiXCircle, FiAlertCircle, FiTrash2 } from 'react-icons/fi';
import pendingRequestService from '../services/pendingRequestService';
import Card from '../components/common/Card';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';
import {
  getModuleDisplayName,
  getActionDisplayName,
  getStatusColor,
  getTimeRemaining,
  formatChangesSummaryText,
  generateChangesSummary,
} from '../utils/requestUtils';
import { useNavigate } from 'react-router-dom';

const MyPendingRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await pendingRequestService.getMyRequests(activeTab);
      setRequests(response.data);
    } catch (error) {
      toast.error('Failed to fetch requests');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;

    try {
      await pendingRequestService.cancelRequest(requestId);
      toast.success('Request cancelled');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to cancel request');
      console.error(error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <FiClock className="text-yellow-600" />;
      case 'approved':
        return <FiCheckCircle className="text-green-600" />;
      case 'rejected':
        return <FiXCircle className="text-red-600" />;
      case 'expired':
        return <FiAlertCircle className="text-gray-600" />;
      default:
        return <FiClock className="text-gray-600" />;
    }
  };

  const tabs = [
    { key: 'pending', label: 'Pending', count: requests.filter(r => r.status === 'pending').length },
    { key: 'approved', label: 'Approved', count: requests.filter(r => r.status === 'approved').length },
    { key: 'rejected', label: 'Rejected', count: requests.filter(r => r.status === 'rejected').length },
    { key: 'all', label: 'All', count: requests.length },
  ];

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Requests</h1>
        <p className="text-gray-600 mt-2">Track your pending approval requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Request Cards */}
      {requests.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Requests Found</h3>
            <p className="text-gray-600">
              {activeTab === 'pending' 
                ? 'You have no pending requests at the moment.'
                : `You have no ${activeTab} requests.`}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request._id}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  {/* Left Side */}
                  <div className="flex-1">
                    {/* Status Badge & Module */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {getModuleDisplayName(request.module)}
                      </span>
                    </div>

                    {/* Record Identifier */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {getActionDisplayName(request.action)} {request.recordIdentifier}
                    </h3>

                    {/* Changes Summary */}
                    {request.action === 'edit' && request.oldData && request.newData && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <p className="text-sm text-gray-600 font-medium mb-2">Changes:</p>
                        <div className="space-y-1">
                          {generateChangesSummary(request.oldData, request.newData).slice(0, 3).map((change, idx) => (
                            <div key={idx} className="text-sm flex items-center gap-2">
                              <span className="text-gray-600">{change.field}:</span>
                              <span className="text-red-600 line-through">{change.oldValue}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600 font-medium">{change.newValue}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rejection Details */}
                    {request.status === 'rejected' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                        <p className="text-sm font-medium text-red-900 mb-1">Rejection Reason:</p>
                        <p className="text-sm text-red-700">
                          {request.rejectionReason?.replace('-', ' ').toUpperCase()}
                        </p>
                        {request.rejectionNote && (
                          <p className="text-sm text-red-600 mt-2 italic">
                            "{request.rejectionNote}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Requested: {new Date(request.requestedAt).toLocaleString()}</span>
                      {request.status === 'pending' && (
                        <span className="text-orange-600 font-medium">
                          ⏰ {getTimeRemaining(request.expiresAt)}
                        </span>
                      )}
                      {request.reviewedAt && (
                        <span>
                          Reviewed: {new Date(request.reviewedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Side - Actions */}
                  <div className="ml-4">
                    {request.status === 'pending' && (
                      <button
                        onClick={() => handleCancelRequest(request._id)}
                        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <FiTrash2 />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyPendingRequests;
