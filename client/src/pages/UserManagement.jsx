import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api'; // ✅ Import api instead of axios
import Card from '../components/common/Card';
import Modal from '../components/common/Modal';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';
import { FiUsers, FiPlus, FiTrash2, FiUserCheck, FiUserX } from 'react-icons/fi';
import { format } from 'date-fns';

const UserManagement = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    phone: '',
    role: 'sales',
  });

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/users'); // ✅ Fixed
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    setSubmitting(true);
    
    try {
      await api.post('/auth/users', formData); // ✅ Fixed - changed to /auth/users
      toast.success('User created successfully');
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await api.put(`/auth/users/${userId}`, { // ✅ Fixed
        isActive: !currentStatus,
      });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await api.delete(`/auth/users/${userId}`); // ✅ Fixed
        toast.success('User deleted successfully');
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to delete user');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      businessName: '',
      phone: '',
      role: 'sales',
    });
  };

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) return <Loader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FiUsers className="text-blue-500" />
          User Management
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-lg font-semibold text-sm hover:bg-blue-600 transition-all"
        >
          <FiPlus /> Add User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <FiUsers className="text-2xl text-blue-500" />
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Total Users</div>
              <div className="text-3xl font-bold text-gray-900">{users.length}</div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
              <FiUserCheck className="text-2xl text-green-500" />
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Active Users</div>
              <div className="text-3xl font-bold text-gray-900">
                {users.filter(u => u.isActive).length}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
              <FiUserX className="text-2xl text-purple-500" />
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Admins</div>
              <div className="text-3xl font-bold text-gray-900">
                {users.filter(u => u.role === 'admin').length}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold text-sm border-b-2 border-gray-200">Name</th>
                <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold text-sm border-b-2 border-gray-200">Email</th>
                <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold text-sm border-b-2 border-gray-200">Role</th>
                <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold text-sm border-b-2 border-gray-200">Status</th>
                <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold text-sm border-b-2 border-gray-200">Created</th>
                <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold text-sm border-b-2 border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="p-4 border-b border-gray-200 text-sm">
                    <strong>{user.name}</strong>
                  </td>
                  <td className="p-4 border-b border-gray-200 text-sm">{user.email}</td>
                  <td className="p-4 border-b border-gray-200 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role === 'admin' ? '👑 Admin' : '💼 Sales'}
                    </span>
                  </td>
                  <td className="p-4 border-b border-gray-200 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 border-b border-gray-200 text-sm text-gray-600">
                    {format(new Date(user.createdAt), 'dd MMM yyyy')}
                  </td>
                  <td className="p-4 border-b border-gray-200 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleStatus(user._id, user.isActive)}
                        className={`p-2 rounded-md transition-all ${
                          user.isActive
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                        title={user.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {user.isActive ? <FiUserX /> : <FiUserCheck />}
                      </button>
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all"
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add User Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title="Add New User">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Password *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">Role *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="sales">Sales Person</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {submitting ? 'Creating User...' : 'Create User'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default UserManagement;
