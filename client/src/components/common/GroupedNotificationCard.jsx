import { useState } from 'react';
import { notificationService } from '../../services/notificationService';
import { FiMail, FiCheck, FiEdit, FiCalendar, FiClock, FiX, FiCreditCard, FiAlertTriangle } from 'react-icons/fi';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const GroupedNotificationCard = ({ group, onUpdate }) => {
  const [expandedNotes, setExpandedNotes] = useState({});
  
  // Find overdue and credit limit notifications
  const overdueNotif = group.notifications.find(n => n.type === 'overdue_payment');
  const creditNotif = group.notifications.find(n => n.type === 'credit_limit_80');
  
  // Get highest severity for the card
  const severityOrder = { critical: 4, urgent: 3, moderate: 2, warning: 1 };
  const highestSeverity = group.notifications.reduce((max, n) => {
    return severityOrder[n.severity] > severityOrder[max] ? n.severity : max;
  }, 'warning');
  
  const getSeverityIcon = (severity) => {
    const icons = {
      critical: '🔴',
      urgent: '🟠',
      moderate: '🟡',
      warning: '⚠️'
    };
    return icons[severity] || '⚠️';
  };
  
  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'border-red-500 bg-red-50',
      urgent: 'border-orange-500 bg-orange-50',
      moderate: 'border-yellow-500 bg-yellow-50',
      warning: 'border-blue-500 bg-blue-50'
    };
    return colors[severity] || 'border-gray-300 bg-white';
  };
  
  const handleAction = async (notificationId, action, data = {}) => {
    try {
      switch (action) {
        case 'resolve':
          await notificationService.resolveNotification(notificationId, data);
          toast.success('Marked as paid!');
          break;
        case 'snooze':
          await notificationService.snoozeNotification(notificationId, data);
          toast.success('Snoozed notification');
          break;
        case 'dismiss':
          await notificationService.dismissNotification(notificationId);
          toast.success('Notification dismissed');
          break;
        case 'note':
          await notificationService.addContactNote(notificationId, data);
          toast.success('Note added');
          break;
        case 'promise':
          await notificationService.setPaymentPromise(notificationId, data);
          toast.success('Payment promise recorded');
          break;
        case 'email':
          await notificationService.sendBulkEmails([notificationId]);
          toast.success('Email sent!');
          break;
        default:
          break;
      }
      onUpdate();
    } catch (error) {
      toast.error('Action failed: ' + error.message);
    }
  };

  return (
    <div className={`border-l-4 ${getSeverityColor(highestSeverity)} rounded-lg shadow-md overflow-hidden mb-6`}>
      {/* Buyer Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="text-4xl">{getSeverityIcon(highestSeverity)}</div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{group.businessName || group.buyerName}</h3>
              <p className="text-gray-600 mt-1">{group.buyerName} • {group.buyerContact}</p>
              <div className="flex items-center gap-3 mt-2">
                {group.isTrusted ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    ✅ Trusted
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                    ⚠️ Not Trusted
                  </span>
                )}
                {group.buyerEmail ? (
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <FiMail size={14} /> {group.buyerEmail}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-red-600">
                    <FiMail size={14} /> No Email
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Sections */}
      <div className="bg-gray-50">
        {/* Overdue Payment Section */}
        {overdueNotif && (
          <div className="p-6 bg-white border-b-2 border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <FiAlertTriangle className="text-red-600" size={20} />
              <h4 className="text-lg font-bold text-gray-900">Overdue Payment</h4>
              <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(overdueNotif.severity)}`}>
                {overdueNotif.severity.toUpperCase()}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Amount Due</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{overdueNotif.amountDue?.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Days Overdue</p>
                <p className="text-2xl font-bold text-gray-900">{overdueNotif.daysOverdue}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Orders</p>
                <p className="text-2xl font-bold text-orange-600">{overdueNotif.pendingOrdersCount || 0}</p>
              </div>
            </div>
            
            {/* Overdue Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAction(overdueNotif._id, 'email')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FiMail /> Send Email
              </button>
              <button
                onClick={() => {
                  const amount = prompt('Enter payment amount:');
                  if (amount) handleAction(overdueNotif._id, 'resolve', { paymentAmount: Number(amount), paymentMethod: 'Cash' });
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FiCheck /> Mark as Paid
              </button>
              <button
                onClick={() => {
                  const details = prompt('Add a note:');
                  if (details) handleAction(overdueNotif._id, 'note', { details, method: 'note' });
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FiEdit /> Add Note
              </button>
              <button
                onClick={() => {
                  const date = prompt('Payment promise date (YYYY-MM-DD):');
                  if (date) handleAction(overdueNotif._id, 'promise', { promisedDate: date, amount: overdueNotif.amountDue });
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FiCalendar /> Set Promise
              </button>
              <button
                onClick={() => {
                  const days = prompt('Snooze for how many days?');
                  if (days) {
                    const until = new Date();
                    until.setDate(until.getDate() + Number(days));
                    handleAction(overdueNotif._id, 'snooze', { snoozedUntil: until });
                  }
                }}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FiClock /> Snooze
              </button>
              <button
                onClick={() => {
                  if (confirm('Dismiss this notification?')) {
                    handleAction(overdueNotif._id, 'dismiss');
                  }
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FiX /> Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Credit Limit Section */}
        {creditNotif && (
          <div className="p-6 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <FiCreditCard className="text-orange-600" size={20} />
              <h4 className="text-lg font-bold text-gray-900">Credit Limit Warning</h4>
              <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(creditNotif.severity)}`}>
                {creditNotif.severity.toUpperCase()}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Credit Usage</p>
                <p className="text-2xl font-bold text-orange-600">{creditNotif.creditUsagePercent}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Due</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{creditNotif.amountDue?.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Available Credit</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{((group.buyer?.creditLimit || 0) - creditNotif.amountDue).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            
            {/* Credit Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAction(creditNotif._id, 'email')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FiMail /> Send Warning Email
              </button>
              <button
                onClick={() => {
                  const details = prompt('Add a note about credit limit:');
                  if (details) handleAction(creditNotif._id, 'note', { details, method: 'note' });
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FiEdit /> Add Note
              </button>
              <button
                onClick={() => {
                  if (confirm('Dismiss credit limit warning?')) {
                    handleAction(creditNotif._id, 'dismiss');
                  }
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <FiX /> Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupedNotificationCard;
