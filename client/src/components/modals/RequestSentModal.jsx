import { FiCheckCircle, FiClock, FiEye } from 'react-icons/fi';
import Modal from '../common/Modal';

const RequestSentModal = ({ isOpen, onClose, requestData, onViewRequests }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="text-center py-6">
        {/* Success Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
          <FiCheckCircle className="h-10 w-10 text-green-600" />
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Request Sent to Admin!
        </h3>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          Your request to <span className="font-semibold">{requestData?.action}</span>{' '}
          <span className="font-semibold">{requestData?.recordIdentifier}</span> has been submitted for approval.
        </p>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <FiClock className="text-blue-600 mt-1 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">What happens next?</p>
              <ul className="space-y-1 text-gray-600">
                <li>• Admin will review your request within 24 hours</li>
                <li>• You'll be notified once it's approved or rejected</li>
                <li>• Request will auto-expire after 24 hours if not reviewed</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onViewRequests}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiEye />
            View My Requests
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RequestSentModal;
