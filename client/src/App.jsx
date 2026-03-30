import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { format, isSameDay, parseISO } from 'date-fns';
import toast, { Toaster } from 'react-hot-toast';
import { Calendar, Clock, User, Phone, Stethoscope, MessageSquare, PlusCircle, Trash2, Edit, BriefcaseMedical, Filter, X, LogOut, Mail, Lock, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Chatbot from './components/Chatbot';

// const api = axios.create({ baseURL: 'http://localhost:5000/api' });
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers['x-auth-token'] = token;
    return config;
});
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const App = () => ( <AuthProvider> <Toaster position="top-center" reverseOrder={false} /> <MainRouter /> </AuthProvider> );

const MainRouter = () => {
    const { user, loading } = useAuth();
    if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
    const path = window.location.pathname;
    if (path.startsWith('/admin')) return user?.role === 'ADMIN' ? <SchedulerApp /> : <AdminLoginPage />;
    return user?.role === 'PATIENT' ? <SchedulerApp /> : <PatientAuthPage />;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        if (token && userData) setUser(JSON.parse(userData));
        setLoading(false);
    }, []);
    const login = (userData, token) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        window.location.reload();
    };
    const logout = () => {
        const isAdminPage = window.location.pathname.startsWith('/admin');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        toast.success('Logged out successfully.');
        window.location.pathname = isAdminPage ? '/admin' : '/';
    };
    return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
};

const AdminLoginPage = () => {
    const { login } = useAuth();
    const { register, handleSubmit, formState: { errors } } = useForm();
    const onSubmit = data => {
        toast.promise(
            api.post('/auth/admin-login', data).then(res => login(res.data.user, res.data.token)),
            { loading: 'Verifying...', success: 'Admin access granted!', error: (err) => err.response?.data?.msg || 'Verification failed.' }
        );
    };
    return <div className="min-h-screen bg-slate-800 flex items-center justify-center"><motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-2xl"><h2 className="text-3xl font-bold text-center text-slate-900">Admin Access</h2><form onSubmit={handleSubmit(onSubmit)} className="space-y-4"><InputField icon={<KeyRound />} label="Secret Key" name="secretKey" type="password" register={register} errors={errors} required /><button type="submit" className="w-full px-4 py-3 font-semibold text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors">Unlock</button></form></motion.div></div>;
};
const PatientAuthPage = () => { const [isLogin, setIsLogin] = useState(true); return isLogin ? <LoginPage onSwitchPage={() => setIsLogin(false)} /> : <RegisterPage onSwitchPage={() => setIsLogin(true)} />; };
const LoginPage = ({ onSwitchPage }) => {
    const { login } = useAuth();
    const { register, handleSubmit, formState: { errors } } = useForm();
    const onSubmit = data => { toast.promise(api.post('/auth/login', data).then(res => login(res.data.user, res.data.token)),{ loading: 'Logging in...', success: 'Login successful!', error: (err) => err.response?.data?.msg || 'Login failed.' }); };
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg"><h2 className="text-3xl font-bold text-center text-slate-900">Patient Login</h2><form onSubmit={handleSubmit(onSubmit)} className="space-y-4"><InputField icon={<Mail />} label="Email" name="email" type="email" register={register} errors={errors} required /><InputField icon={<Lock />} label="Password" name="password" type="password" register={register} errors={errors} required /><button type="submit" className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">Login</button></form><p className="text-sm text-center text-slate-500">Don't have an account? <button onClick={onSwitchPage} className="font-medium text-blue-600 hover:underline">Register here</button></p></motion.div></div>;
};
const RegisterPage = ({ onSwitchPage }) => {
    const { login } = useAuth();
    const { register, handleSubmit, formState: { errors } } = useForm();
    const onSubmit = data => { toast.promise(api.post('/auth/register', data).then(res => login(res.data.user, res.data.token)),{ loading: 'Creating account...', success: 'Registration successful!', error: (err) => err.response?.data?.msg || 'Registration failed.' }); };
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12"><motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg"><h2 className="text-3xl font-bold text-center text-slate-900">Create Patient Account</h2><form onSubmit={handleSubmit(onSubmit)} className="space-y-4"><InputField icon={<User />} label="Full Name" name="name" register={register} errors={errors} required /><InputField icon={<Mail />} label="Email" name="email" type="email" register={register} errors={errors} required /><InputField icon={<Lock />} label="Password" name="password" type="password" register={register} errors={errors} required /><InputField icon={<Phone />} label="Phone Number" name="phone" register={register} errors={errors} required /><InputField icon={<Calendar />} label="Date of Birth" name="dob" type="date" register={register} errors={errors} required /><button type="submit" className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">Register</button></form><p className="text-sm text-center text-slate-500">Already have an account? <button onClick={onSwitchPage} className="font-medium text-blue-600 hover:underline">Login here</button></p></motion.div></div>;
};

const SchedulerApp = () => {
    const { user, logout } = useAuth();
    const formatDateTimeForInput = (date) => { if (!date) return ''; const d = new Date(date); const tzOffset = d.getTimezoneOffset() * 60000; const localDate = new Date(d - tzOffset); return localDate.toISOString().slice(0, 16); };
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ date: format(new Date(), 'yyyy-MM-dd'), doctorId: 'all', status: 'all' });
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState(null);
    const [isRegisterPatientModalOpen, setIsRegisterPatientModalOpen] = useState(false);
    const [newPatientData, setNewPatientData] = useState(null);

    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();
    const { register: registerPatient, handleSubmit: handlePatientSubmit, reset: resetPatient, formState: { errors: patientErrors } } = useForm();
    const doctorForm = useForm();

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [appointmentsResponse, doctorsResponse] = await Promise.all([ api.get('/appointments'), api.get('/doctors') ]);
                setAppointments(appointmentsResponse.data);
                setDoctors(doctorsResponse.data);
            } catch (err) {
                toast.error('Session may have expired.');
                if (err.response?.status === 401) logout();
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [logout]);

    const filteredAppointments = useMemo(() => {
        if (user.role === 'PATIENT') return appointments;
        return appointments.filter(apt => {
            const dateMatch = filters.date ? isSameDay(parseISO(apt.appointmentDate), parseISO(filters.date)) : true;
            const doctorMatch = filters.doctorId === 'all' || apt.doctorId === filters.doctorId;
            const statusMatch = filters.status === 'all' || apt.status === filters.status;
            return dateMatch && doctorMatch && statusMatch;
        });
    }, [appointments, filters, user]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const closeAppointmentModal = () => {
        setEditingAppointment(null);
        reset();
        setIsAppointmentModalOpen(false);
    };
    
    // --- START OF RESTORED CODE ---

    const onAppointmentSubmit = async (data) => {
        const process = editingAppointment ? onUpdateAppointment(data) : onCreateAppointment(data);
        await toast.promise(process, {
            loading: editingAppointment ? 'Saving...' : 'Booking...',
            success: `Appointment ${editingAppointment ? 'updated' : 'booked'}!`,
            error: (err) => err.response?.data?.msg || `Failed.`
        });
    };

    const onCreateAppointment = async (data) => {
        const newAppointmentData = {
            doctorId: data.doctorId, appointmentDate: new Date(data.appointmentDate).toISOString(),
            reasonForVisit: data.reasonForVisit, durationInMinutes: parseInt(data.durationInMinutes)
        };
        if (user.role === 'ADMIN') {
            newAppointmentData.patient = { phone: data.patientPhone, name: data.patientName, dob: data.patientDOB, email: data.patientEmail };
        }
        try {
                        const response = await api.post('/appointments', newAppointmentData);
                        // If backend included nameInfo, show info popup BEFORE closing modal or showing success
                        if (response.data && response.data.nameInfo && response.data.nameInfo.info) {
                            toast((t) => (
                                <div className="text-center">
                                    <span>{response.data.nameInfo.msg}</span>
                                </div>
                            ), { icon: 'ℹ️', duration: 9000 });
                        }
                        // Always add only the appointment object (strip nameInfo if present)
                        const appointmentObj = response.data && response.data.nameInfo ? { ...response.data } : response.data;
                        if (appointmentObj.nameInfo) delete appointmentObj.nameInfo;
                        setAppointments(prev => [...prev, appointmentObj].sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate)));
                        toast.success('Appointment booked successfully!');
                        closeAppointmentModal();
        } catch (err) {
            if (err.response?.data?.errorCode === 'PATIENT_NOT_FOUND') {
                toast.error(err.response.data.msg);
                setNewPatientData(data);
                setIsRegisterPatientModalOpen(true);
            } else {
                toast.error(err.response?.data?.msg || 'Failed to book appointment.');
            }
        }
    };
    
    const onAdminCreatePatientAndBook = async (patientData) => {
        try {
            toast.loading('Creating new patient...');
            const patientResponse = await api.post('/patients/admin-create', patientData);
            toast.dismiss();
            toast.success(`Patient ${patientResponse.data.name} created! Now booking appointment...`);
            setIsRegisterPatientModalOpen(false);
            resetPatient();
            
            const originalBookingData = { ...newPatientData, patientPhone: patientData.phone };
            await onCreateAppointment(originalBookingData);
            setNewPatientData(null);
        } catch (err) {
            toast.dismiss();
            // If patient with phone already exists, show a popup with the name
            if (err.response && err.response.status === 409 && err.response.data?.existingPatientName) {
                toast.error(`A patient with this phone number is already registered as "${err.response.data.existingPatientName}". Please inform the person that this name is linked with this phone number.`);
            } else {
                toast.error(err.response?.data?.msg || 'Failed to create patient.');
            }
        }
    };
    
    const onUpdateAppointment = (data) => {
        const updatedData = {
            appointmentDate: new Date(data.appointmentDate).toISOString(),
            reasonForVisit: data.reasonForVisit,
            doctorId: data.doctorId,
            status: data.status,
            durationInMinutes: parseInt(data.durationInMinutes)
        };
        return api.put(`/appointments/${editingAppointment.id}`, updatedData).then(response => {
            setAppointments(prev => prev.map(apt => (apt.id === editingAppointment.id ? response.data : apt)).sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate)));
            closeAppointmentModal();
        });
    };

    const onAddDoctor = async (data) => {
        await toast.promise(
            api.post('/doctors', data).then(response => { setDoctors(prev => [...prev, response.data]); doctorForm.reset(); setIsDoctorModalOpen(false); }),
            { loading: 'Adding doctor...', success: 'Doctor added!', error: (err) => err.response?.data?.msg || 'Failed.' }
        );
    };
    
    const handleCancelAppointment = (id) => {
        toast((t) => ( <div className="text-center"> <span>Are you sure?</span> <div className="flex gap-2 mt-2 justify-center"> <button onClick={() => { toast.dismiss(t.id); performCancellation(id); }} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">Confirm</button> <button onClick={() => toast.dismiss(t.id)} className="bg-slate-200 hover:bg-slate-300 font-bold py-1 px-3 rounded text-sm">Cancel</button> </div> </div> ));
    };

    const performCancellation = async (id) => {
        await toast.promise( api.delete(`/appointments/${id}`).then(() => setAppointments(prev => prev.map(apt => apt.id === id ? { ...apt, status: 'Cancelled' } : apt))), { loading: 'Cancelling...', success: 'Cancelled.', error: 'Failed.' });
    };

    const openAppointmentModalForEdit = (appointment) => {
        setEditingAppointment(appointment);
        setValue('patientName', appointment.patient.name);
        setValue('patientPhone', appointment.patient.phone);
        setValue('patientDOB', format(new Date(appointment.patient.dob), 'yyyy-MM-dd'));
        setValue('patientEmail', appointment.patient.email);
        setValue('appointmentDate', formatDateTimeForInput(appointment.appointmentDate));
        setValue('doctorId', appointment.doctorId);
        setValue('reasonForVisit', appointment.reasonForVisit);
        setValue('status', appointment.status);
        setValue('durationInMinutes', appointment.durationInMinutes);
        setIsAppointmentModalOpen(true);
    };

    const openNewAppointmentModal = () => {
        if (user.role === 'PATIENT' && user.patientId) {
            api.get(`/patients/${user.patientId}`).then(res => {
                 setValue('patientName', res.data.name);
                 setValue('patientPhone', res.data.phone);
                 setValue('patientDOB', format(new Date(res.data.dob), 'yyyy-MM-dd'));
                 setValue('patientEmail', res.data.email);
            }).catch(() => toast.error('Could not load your patient data.'));
        }
        setIsAppointmentModalOpen(true);
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="container mx-auto p-4 md:p-8">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div><h1 className="text-4xl font-bold text-slate-900">{user.role === 'ADMIN' ? 'Clinic Dashboard' : 'My Appointments'}</h1><p className="text-slate-500">Welcome, {user.name}!</p></div>
                    <div className="flex items-center gap-2">
                        {user.role === 'ADMIN' && <AdminButtons onAddDoctor={() => setIsDoctorModalOpen(true)} onNewAppointment={openNewAppointmentModal} />}
                        {user.role === 'PATIENT' && <PatientButtons onNewAppointment={openNewAppointmentModal} />}
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={logout} className="flex items-center gap-2 bg-slate-600 text-white font-semibold px-4 py-3 rounded-lg shadow-md hover:bg-slate-700"><LogOut size={20} /> Logout</motion.button>
                    </div>
                </header>
                {user.role === 'ADMIN' && <FilterBar filters={filters} doctors={doctors} onFilterChange={handleFilterChange} />}
                <main>
                    {loading ? <p className="text-center text-lg">Loading...</p> : 
                     filteredAppointments.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><AnimatePresence>{filteredAppointments.map(apt => <AppointmentCard key={apt.id} appointment={apt} onCancel={handleCancelAppointment} onEdit={openAppointmentModalForEdit} />)}</AnimatePresence></div>
                    ) : (
                        <div className="text-center py-16 px-6 bg-white rounded-lg shadow"><h3 className="text-xl font-semibold text-slate-800">No Appointments Found</h3><p className="text-slate-500 mt-2">Try adjusting filters or book a new appointment.</p></div>
                    )}
                </main>
            </div>
            {/* The form now correctly passes onAppointmentSubmit */}
            <AppointmentModal isOpen={isAppointmentModalOpen} onClose={closeAppointmentModal} onSubmit={handleSubmit(onAppointmentSubmit)} register={register} errors={errors} doctors={doctors} isEditing={!!editingAppointment} isPatient={user.role === 'PATIENT'} />
            {user.role === 'ADMIN' && <AddDoctorModal isOpen={isDoctorModalOpen} onClose={() => setIsDoctorModalOpen(false)} formMethods={doctorForm} onSubmit={onAddDoctor} />}
            {user.role === 'ADMIN' && <RegisterPatientModal isOpen={isRegisterPatientModalOpen} onClose={() => setIsRegisterPatientModalOpen(false)} onSubmit={handlePatientSubmit(onAdminCreatePatientAndBook)} register={registerPatient} errors={patientErrors} initialData={newPatientData} />}
            <Chatbot />
        </div>
    );
};

const RegisterPatientModal = ({ isOpen, onClose, onSubmit, register, errors, initialData }) => {
    const { setValue } = useForm();
    useEffect(() => {
        if (initialData) {
            setValue('name', initialData.patientName);
            setValue('phone', initialData.patientPhone);
            setValue('email', initialData.patientEmail);
            setValue('dob', initialData.patientDOB);
        }
    }, [initialData, setValue]);

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-2xl font-bold mb-2">Register New Patient</h2>
            <p className="text-slate-500 mb-6">This patient was not found. Please create an account for them to proceed.</p>
            <form onSubmit={onSubmit} className="space-y-4">
                <InputField icon={<User />} label="Full Name" name="name" register={register} errors={errors} required defaultValue={initialData?.patientName} />
                <InputField icon={<Mail />} label="Email" name="email" type="email" register={register} errors={errors} required defaultValue={initialData?.patientEmail} />
                <InputField icon={<Phone />} label="Phone Number" name="phone" register={register} errors={errors} required defaultValue={initialData?.patientPhone} />
                <InputField icon={<Calendar />} label="Date of Birth" name="dob" type="date" register={register} errors={errors} required defaultValue={initialData?.patientDOB} />
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200">Cancel</button>
                    <button type="submit" className="px-6 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 font-semibold">Create Patient & Book</button>
                </div>
            </form>
        </Modal>
    );
};
const AdminButtons = ({ onAddDoctor, onNewAppointment }) => (<><motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onAddDoctor} className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-3 rounded-lg shadow-md hover:bg-green-700"><BriefcaseMedical size={20} /> Add Doctor</motion.button><motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onNewAppointment} className="flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-3 rounded-lg shadow-md hover:bg-blue-700"><PlusCircle size={20} /> New Appointment</motion.button></>);
const PatientButtons = ({ onNewAppointment }) => (<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onNewAppointment} className="flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-3 rounded-lg shadow-md hover:bg-blue-700"><PlusCircle size={20} /> Book New Appointment</motion.button>);
const FilterBar = ({ filters, doctors, onFilterChange }) => (<div className="bg-white p-4 rounded-lg shadow-md mb-8 flex flex-col sm:flex-row gap-4 items-center"><div className="flex items-center gap-2 text-slate-600 font-semibold flex-shrink-0"><Filter size={20} /><span>Filter by:</span></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full"><div className="relative"><input type="date" name="date" value={filters.date} onChange={onFilterChange} className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-8"/>{filters.date && <button onClick={() => onFilterChange({target: {name: 'date', value: ''}})} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={18} /></button>}</div><select name="doctorId" value={filters.doctorId} onChange={onFilterChange} className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"><option value="all">All Doctors</option>{doctors.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}</select><select name="status" value={filters.status} onChange={onFilterChange} className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"><option value="all">All Statuses</option><option value="Scheduled">Scheduled</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></select></div></div>);
const AppointmentCard = ({ appointment, onCancel, onEdit }) => (<motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className={`p-5 rounded-xl shadow-lg border-l-4 ${ appointment.status === 'Scheduled' ? 'bg-white border-blue-500' : appointment.status === 'Completed' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500' }`}><div className="flex justify-between items-start"><div><p className="font-bold text-lg">{appointment.patient.name}</p><p className="text-sm text-slate-500">with {appointment.doctor.name}</p></div><span className={`text-xs font-semibold px-3 py-1 rounded-full ${ appointment.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' : appointment.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{appointment.status}</span></div><div className="border-t my-4"></div><div className="space-y-3 text-sm"><div className="flex items-center gap-3"><Calendar size={16} className="text-slate-400" /> <span>{format(new Date(appointment.appointmentDate), 'eeee, MMM d, yyyy')}</span></div><div className="flex items-center gap-3"><Clock size={16} className="text-slate-400" /> <span>{format(new Date(appointment.appointmentDate), 'h:mm a')}</span></div><div className="flex items-center gap-3"><MessageSquare size={16} className="text-slate-400" /> <span className="italic">"{appointment.reasonForVisit}"</span></div></div>{appointment.status === 'Scheduled' && (<div className="flex justify-end gap-2 mt-4"><button onClick={() => onEdit(appointment)} className="p-2 text-slate-500 hover:text-blue-600"><Edit size={16}/></button><button onClick={() => onCancel(appointment.id)} className="p-2 text-slate-500 hover:text-red-600"><Trash2 size={16}/></button></div>)}</motion.div>);
const AppointmentModal = ({ isOpen, onClose, onSubmit, register, errors, doctors, isEditing, isPatient }) => (<Modal isOpen={isOpen} onClose={onClose}><h2 className="text-2xl font-bold mb-6">{isEditing ? 'Edit Appointment' : 'New Appointment'}</h2><form onSubmit={onSubmit} className="space-y-4"><InputField icon={<User />} label="Patient Name" name="patientName" register={register} errors={errors} required disabled={isEditing || isPatient} /><InputField icon={<Phone />} label="Patient Phone" name="patientPhone" register={register} errors={errors} required disabled={isEditing || isPatient} /><InputField icon={<Mail />} label="Patient Email" name="patientEmail" type="email" register={register} errors={errors} required={!isPatient && !isEditing} disabled={isEditing || isPatient} /><InputField icon={<Calendar />} label="Patient Date of Birth" name="patientDOB" type="date" register={register} errors={errors} required disabled={isEditing || isPatient} /><div className="border-t pt-4 space-y-4"><div><label className="block text-sm font-medium text-slate-600 mb-1">Doctor</label><div className="relative"><Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/><select {...register('doctorId', { required: true })} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"><option value="">Select a Doctor</option>{doctors.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.specialization})</option>)}</select></div></div><div className="grid grid-cols-2 gap-4"><InputField icon={<Calendar />} label="Appt. Date & Time" name="appointmentDate" type="datetime-local" register={register} errors={errors} required /><InputField icon={<Clock />} label="Duration (mins)" name="durationInMinutes" type="number" register={register} errors={errors} required defaultValue={30} /></div><InputField icon={<MessageSquare />} label="Reason for Visit" name="reasonForVisit" register={register} errors={errors} required />{isEditing && (<div><label className="block text-sm font-medium text-slate-600 mb-1">Status</label><select {...register('status', { required: true })} className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500" disabled={isPatient}><option value="Scheduled">Scheduled</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></select></div>)}</div><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200">Cancel</button><button type="submit" className="px-6 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 font-semibold">{isEditing ? 'Save Changes' : 'Book'}</button></div></form></Modal>);
const AddDoctorModal = ({ isOpen, onClose, formMethods, onSubmit }) => (<Modal isOpen={isOpen} onClose={onClose}><h2 className="text-2xl font-bold mb-6">Add New Doctor</h2><form onSubmit={formMethods.handleSubmit(onSubmit)} className="space-y-4"><InputField icon={<User />} label="Doctor Name" name="name" register={formMethods.register} errors={formMethods.formState.errors} required /><InputField icon={<BriefcaseMedical />} label="Specialization" name="specialization" register={formMethods.register} errors={formMethods.formState.errors} required /><InputField icon={<Phone />} label="Phone Number" name="phone" register={formMethods.register} errors={formMethods.formState.errors} required /><InputField icon={<User />} label="Email (Optional)" name="email" type="email" register={formMethods.register} errors={formMethods.formState.errors} /><div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200">Cancel</button><button type="submit" className="px-6 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 font-semibold">Save Doctor</button></div></form></Modal>);
const Modal = ({ isOpen, onClose, children }) => (<AnimatePresence>{isOpen && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}><motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>{children}</motion.div></motion.div>)}</AnimatePresence>);
const InputField = ({ icon, label, name, type = 'text', register, errors, required = false, disabled = false, defaultValue }) => (<div><label htmlFor={name} className="block text-sm font-medium text-slate-600 mb-1">{label}</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{React.cloneElement(icon, { size: 20 })}</span><input id={name} type={type} defaultValue={defaultValue} {...register(name, { required: required && `${label} is required` })} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed" disabled={disabled} /></div>{errors[name] && <span className="text-red-500 text-xs mt-1">{errors[name].message}</span>}</div>);

export default App;
