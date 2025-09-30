const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // We need bcrypt to hash passwords for our seed users
const prisma = new PrismaClient();

// Helper functions (no changes)
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function getRandomDate() {
    const today = new Date();
    const daysToAdd = Math.floor(Math.random() * 30) - 15;
    today.setDate(today.getDate() + daysToAdd);
    today.setHours(Math.floor(Math.random() * 9) + 9);
    today.setMinutes(getRandomElement([0, 15, 30, 45]));
    return today;
}

async function main() {
    console.log('Seeding started...');

    // 1. Clean up existing data
    await prisma.appointment.deleteMany({});
    await prisma.doctor.deleteMany({});
    await prisma.patient.deleteMany({});
    await prisma.user.deleteMany({}); // Also clean up users
    console.log('Cleared existing data.');

    // 2. Create Doctors (no changes)
    const doctorsToCreate = [
        { name: 'Dr. Evelyn Reed', specialization: 'Cardiology', phone: '555-0101', email: 'e.reed@clinic.com' },
        { name: 'Dr. Samuel Carter', specialization: 'Pediatrics', phone: '555-0102', email: 's.carter@clinic.com' },
        { name: 'Dr. Alice Johnson', specialization: 'Neurology', phone: '555-0103', email: 'a.johnson@clinic.com' },
        { name: 'Dr. Ben Hanson', specialization: 'Orthopedics', phone: '555-0104', email: 'b.hanson@clinic.com' },
    ];
    await prisma.doctor.createMany({ data: doctorsToCreate });
    console.log('Created doctors.');

    // --- THE FIX IS HERE: Create Users and Patients Together ---
    console.log('Creating users and patients...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt); // Use a standard password for all seed users

    const usersToCreate = [
        { name: 'Liam Smith', email: 'liam@test.com', phone: '555-0201', dob: new Date('1988-05-21') },
        { name: 'Olivia Brown', email: 'olivia@test.com', phone: '555-0202', dob: new Date('1992-11-09') },
        { name: 'Noah Jones', email: 'noah@test.com', phone: '555-0203', dob: new Date('1975-03-15') },
        { name: 'Emma Garcia', email: 'emma@test.com', phone: '555-0204', dob: new Date('2001-07-30') },
        { name: 'Oliver Miller', email: 'oliver@test.com', phone: '555-0205', dob: new Date('1985-01-22') },
    ];

    for (const u of usersToCreate) {
        await prisma.user.create({
            data: {
                name: u.name,
                email: u.email,
                password: hashedPassword,
                patient: { // Prisma creates the related patient profile automatically
                    create: {
                        name: u.name,
                        phone: u.phone,
                        email: u.email,
                        dob: u.dob,
                    },
                },
            },
        });
    }
    console.log('Created users and patients.');
    // --- END OF FIX ---


    // 4. Fetch the IDs of the records we just created
    const createdDoctors = await prisma.doctor.findMany();
    const createdPatients = await prisma.patient.findMany();

    // 5. Create Appointments (no changes)
    const appointmentsToCreate = [];
    const statuses = ['Scheduled', 'Completed', 'Cancelled'];
    const reasons = ['Annual Check-up', 'Follow-up Visit', 'New Symptom Consultation', 'Prescription Refill', 'Routine Test'];

    for (let i = 0; i < 25; i++) {
        const randomDoctor = getRandomElement(createdDoctors);
        const randomPatient = getRandomElement(createdPatients);
        
        appointmentsToCreate.push({
            doctorId: randomDoctor.id,
            patientId: randomPatient.id,
            appointmentDate: getRandomDate(),
            status: getRandomElement(statuses),
            reasonForVisit: getRandomElement(reasons),
            durationInMinutes: getRandomElement([15, 30, 45, 60]),
        });
    }
    await prisma.appointment.createMany({ data: appointmentsToCreate });
    console.log('Created appointments.');

    console.log('Seeding finished successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });