// backend/src/seed.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User';
import { Board } from './models/Board';
import { Column } from './models/Column';
import { Task } from './models/Task';
import { AuthUtils } from './utils/auth';
import { Role, UserStatus, BoardType, Template, Priority, Department } from './types';
import { RoleModel } from './models/Role';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const ensureRole = async (key: string, name?: string, builtIn = true) => {
  const KEY = key.trim().toUpperCase();
  await RoleModel.updateOne(
    { key: KEY },
    { $setOnInsert: { name: name ?? KEY, builtIn, isActive: true } },
    { upsert: true }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────
const seedData = async (): Promise<void> => {
  try {
    // Connect
    const mongoURL = process.env.MONGO_URL;
    if (!mongoURL) throw new Error('MONGO_URL environment variable is not defined');
    const dbName = process.env.DB_NAME || 'simplified_jira';

    await mongoose.connect(mongoURL, { dbName });
    console.log(`✅ Connected to MongoDB database: ${dbName}`);

    // Optional: wipe roles too (controlled by env)
    if (String(process.env.SEED_RESET_ROLES).toLowerCase() === 'true') {
      console.log('🧹 Clearing roles (by SEED_RESET_ROLES=true)...');
      await RoleModel.deleteMany({});
      console.log('✓ Cleared roles');
    }

    // Always wipe core data
    console.log('🧹 Clearing core collections...');
    await User.deleteMany({});
    await Board.deleteMany({});
    await Column.deleteMany({});
    await Task.deleteMany({});
    console.log('✓ Cleared users, boards, columns, tasks');

    // Base roles
    console.log('🔑 Ensuring base roles...');
    await ensureRole('ADMIN', 'Admin');
    await ensureRole('TECH', 'Tech');
    await ensureRole('DESIGNER', 'Designer');
    await ensureRole('BUYER', 'Buyer');
    await ensureRole('TEAM_LEAD', 'Team Lead'); // базовая роль тимлида
    console.log('✓ Base roles ready');

    // Users
    console.log('👥 Creating users...');
    const users = [
      {
        id: 'admin-001',
        email: 'admin@company.com',
        passwordHash: await AuthUtils.hashPassword('admin123'),
        fullName: 'Admin User',
        roles: [Role.ADMIN], // 'admin'
        status: UserStatus.ACTIVE,
      },
      {
        id: 'lead-001',
        email: 'lead@company.com',
        passwordHash: await AuthUtils.hashPassword('lead123'),
        fullName: 'Team Lead',
        roles: [Role.TEAM_LEAD], // 'team_lead'
        status: UserStatus.ACTIVE,
      },
      {
        id: 'buyer-001',
        email: 'buyer@company.com',
        passwordHash: await AuthUtils.hashPassword('buyer123'),
        fullName: 'Alice Buyer',
        roles: [Role.BUYER],
        department: Department.SWIP,
        status: UserStatus.ACTIVE,
      },
      {
        id: 'buyer-002',
        email: 'buyer2@company.com',
        passwordHash: await AuthUtils.hashPassword('buyer123'),
        fullName: 'Bob Buyer',
        roles: [Role.BUYER],
        department: Department.GAMBLING,
        status: UserStatus.ACTIVE,
      },
      {
        id: 'designer-001',
        email: 'designer@company.com',
        passwordHash: await AuthUtils.hashPassword('designer123'),
        fullName: 'Charlie Designer',
        roles: [Role.DESIGNER],
        department: Department.GAMBLING,
        status: UserStatus.ACTIVE,
      },
      {
        id: 'tech-001',
        email: 'tech@company.com',
        passwordHash: await AuthUtils.hashPassword('tech123'),
        fullName: 'David Tech',
        roles: [Role.TECH],
        status: UserStatus.ACTIVE,
      },
    ];
    await User.insertMany(users);
    console.log(`✓ Created ${users.length} users`);

    // Boards (добавил team_lead в allowedRoles, чтобы тимлид видел все борды)
    console.log('📋 Creating boards...');
    const boards = [
      {
        id: 'board-buyers',
        name: 'Buyers',
        key: 'BUY',
        type: BoardType.TASKS,
        template: Template.KANBAN_BASIC,
        allowedRoles: [Role.BUYER, Role.ADMIN, Role.TEAM_LEAD],
        owners: ['buyer-001'],
      },
      {
        id: 'board-designers',
        name: 'Designers',
        key: 'DES',
        type: BoardType.TASKS,
        template: Template.KANBAN_BASIC,
        allowedRoles: [Role.DESIGNER, Role.ADMIN, Role.TEAM_LEAD],
        owners: ['designer-001'],
        // department: Department.GAMBLING,
      },
      {
        id: 'board-tech',
        name: 'Tech',
        key: 'TECH',
        type: BoardType.TASKS,
        template: Template.KANBAN_TJ_TECH,
        allowedRoles: [Role.TECH, Role.ADMIN, Role.TEAM_LEAD],
        owners: ['tech-001'],
      },
      {
        id: 'board-expenses',
        name: 'Expenses',
        key: 'EXP',
        type: BoardType.EXPENSES,
        template: Template.KANBAN_BASIC,
        allowedRoles: [Role.ADMIN, Role.BUYER, Role.TEAM_LEAD],
        owners: ['admin-001'],
      },
    ];
    await Board.insertMany(boards);
    console.log(`✓ Created ${boards.length} boards`);

    // Columns
    console.log('📑 Creating columns...');
    const columns = [
      // Buyers
      { id: 'col-buy-backlog', boardId: 'board-buyers', key: 'BACKLOG', name: 'Backlog', order: 1 },
      { id: 'col-buy-progress', boardId: 'board-buyers', key: 'IN_PROGRESS', name: 'In Progress', order: 2 },
      { id: 'col-buy-to-tech', boardId: 'board-buyers', key: 'TO_TECH', name: 'To Tech', order: 3 },
      { id: 'col-buy-to-designers', boardId: 'board-buyers', key: 'TO_DESIGNERS', name: 'To Designers', order: 4 },
      { id: 'col-buy-done', boardId: 'board-buyers', key: 'DONE', name: 'Done', order: 5 },

      // Designers
      { id: 'col-des-queue', boardId: 'board-designers', key: 'QUEUE', name: 'Queue', order: 1 },
      { id: 'col-des-doing', boardId: 'board-designers', key: 'DOING', name: 'Doing', order: 2 },
      { id: 'col-des-review', boardId: 'board-designers', key: 'REVIEW', name: 'Review', order: 3 },
      { id: 'col-des-done', boardId: 'board-designers', key: 'DONE', name: 'Done', order: 4 },

      // Tech
      { id: 'col-tech-todo', boardId: 'board-tech', key: 'TODO', name: 'Todo', order: 1 },
      { id: 'col-tech-dev', boardId: 'board-tech', key: 'IN_DEV', name: 'In Dev', order: 2 },
      { id: 'col-tech-review', boardId: 'board-tech', key: 'CODE_REVIEW', name: 'Code Review', order: 3 },
      { id: 'col-tech-done', boardId: 'board-tech', key: 'DONE', name: 'Done', order: 4 },

      // Expenses
      { id: 'col-exp-pending', boardId: 'board-expenses', key: 'PENDING', name: 'Pending', order: 1 },
      { id: 'col-exp-approved', boardId: 'board-expenses', key: 'APPROVED', name: 'Approved', order: 2 },
      { id: 'col-exp-paid', boardId: 'board-expenses', key: 'PAID', name: 'Paid', order: 3 },
    ];
    await Column.insertMany(columns);
    console.log(`✓ Created ${columns.length} columns`);

    // Helpers
    const u = (id: string) => users.find(x => x.id === id)!;
    const deptOf = (id: string) => (u(id) as any).department;

    // Tasks
    console.log('📝 Creating tasks...');
    const tasks = [
      // Alice (buyer-001, SWIP)
      {
        id: 'task-buy-001',
        boardKey: 'BUY',
        columnId: 'col-buy-backlog',
        title: 'Research new vendor options (Alice)',
        description: 'Alice needs to find alternative suppliers for Q2',
        priority: Priority.HIGH,
        tags: ['research', 'vendors', 'alice'],
        dueDate: new Date('2025-02-15'),
        assigneeId: 'buyer-001',
        creatorId: 'buyer-001',
        department: deptOf('buyer-001'),
      },
      {
        id: 'task-buy-002',
        boardKey: 'BUY',
        columnId: 'col-buy-progress',
        title: 'Budget approval for new tools (Alice)',
        description: 'Alice is getting approval for design software licenses',
        priority: Priority.MEDIUM,
        tags: ['budget', 'tools', 'alice'],
        assigneeId: 'buyer-001',
        creatorId: 'buyer-001',
        department: deptOf('buyer-001'),
      },

      // Bob (buyer-002, GAMBLING)
      {
        id: 'task-buy-005',
        boardKey: 'BUY',
        columnId: 'col-buy-backlog',
        title: 'Office supplies procurement (Bob)',
        description: 'Bob needs to order office supplies for next quarter',
        priority: Priority.MEDIUM,
        tags: ['office', 'supplies', 'bob'],
        dueDate: new Date('2025-02-20'),
        assigneeId: 'buyer-002',
        creatorId: 'buyer-002',
        department: deptOf('buyer-002'),
      },
      {
        id: 'task-buy-006',
        boardKey: 'BUY',
        columnId: 'col-buy-progress',
        title: 'Equipment lease negotiations (Bob)',
        description: 'Bob is negotiating lease terms for new equipment',
        priority: Priority.HIGH,
        tags: ['equipment', 'lease', 'bob'],
        dueDate: new Date('2025-02-18'),
        assigneeId: 'buyer-002',
        creatorId: 'buyer-002',
        department: deptOf('buyer-002'),
      },

      // Cross-team routing
      {
        id: 'task-buy-003',
        boardKey: 'BUY',
        columnId: 'col-buy-to-tech',
        title: 'Technical requirements for API integration',
        description: 'Need tech team to define API specs for new vendor system',
        priority: Priority.HIGH,
        tags: ['api', 'integration', 'cross-team'],
        dueDate: new Date('2025-02-10'),
        assigneeId: 'tech-001',
        creatorId: 'buyer-001',
        department: deptOf('buyer-001'),
      },
      {
        id: 'task-buy-004',
        boardKey: 'BUY',
        columnId: 'col-buy-to-designers',
        title: 'UI mockups for vendor dashboard',
        description: 'Need designs for the new vendor management interface',
        priority: Priority.MEDIUM,
        tags: ['ui', 'dashboard', 'cross-team'],
        dueDate: new Date('2025-02-20'),
        assigneeId: 'designer-001',
        creatorId: 'buyer-001',
        department: deptOf('buyer-001'),
      },

      // Designer (designer-001, GAMBLING)
      {
        id: 'task-des-001',
        boardKey: 'DES',
        columnId: 'col-des-queue',
        title: 'Landing page redesign',
        description: 'Redesign the main landing page with new branding',
        priority: Priority.HIGH,
        tags: ['landing', 'branding'],
        dueDate: new Date('2025-02-25'),
        assigneeId: 'designer-001',
        creatorId: 'designer-001',
        department: deptOf('designer-001'),
      },
      {
        id: 'task-des-002',
        boardKey: 'DES',
        columnId: 'col-des-doing',
        title: 'Mobile app icon set',
        description: 'Create consistent icon set for mobile application',
        priority: Priority.MEDIUM,
        tags: ['mobile', 'icons'],
        assigneeId: 'designer-001',
        creatorId: 'designer-001',
        department: deptOf('designer-001'),
      },

      // Tech (tech-001)
      {
        id: 'task-tech-001',
        boardKey: 'TECH',
        columnId: 'col-tech-todo',
        title: 'Database migration script',
        description: 'Create migration for new user permissions table',
        priority: Priority.HIGH,
        tags: ['database', 'migration'],
        dueDate: new Date('2025-02-12'),
        assigneeId: 'tech-001',
        creatorId: 'tech-001',
      },
      {
        id: 'task-tech-002',
        boardKey: 'TECH',
        columnId: 'col-tech-dev',
        title: 'Authentication service refactor',
        description: 'Improve JWT token handling and add refresh tokens',
        priority: Priority.MEDIUM,
        tags: ['auth', 'refactor'],
        assigneeId: 'tech-001',
        creatorId: 'tech-001',
      },
      {
        id: 'task-tech-003',
        boardKey: 'TECH',
        columnId: 'col-tech-review',
        title: 'API rate limiting implementation',
        description: 'Add rate limiting middleware to prevent abuse',
        priority: Priority.LOW,
        tags: ['api', 'security'],
        dueDate: new Date('2025-03-01'),
        assigneeId: 'tech-001',
        creatorId: 'tech-001',
      },

      // Expenses
      {
        id: 'task-exp-001',
        boardKey: 'EXP',
        columnId: 'col-exp-pending',
        title: 'Office Supplies - Q1 2025',
        description: 'Purchase necessary office supplies for the first quarter',
        priority: Priority.MEDIUM,
        tags: ['office', 'supplies'],
        amount: 1250.5,
        assigneeId: 'admin-001',
        creatorId: 'buyer-001',
      },
      {
        id: 'task-exp-002',
        boardKey: 'EXP',
        columnId: 'col-exp-approved',
        title: 'Software Licenses - Figma Team',
        description: 'Annual Figma team licenses for design team',
        priority: Priority.HIGH,
        tags: ['software', 'licenses'],
        amount: 4800.0,
        assigneeId: 'admin-001',
        creatorId: 'designer-001',
      },
      {
        id: 'task-exp-003',
        boardKey: 'EXP',
        columnId: 'col-exp-paid',
        title: 'Server Infrastructure - AWS',
        description: 'Monthly AWS infrastructure costs',
        priority: Priority.HIGH,
        tags: ['infrastructure', 'aws'],
        amount: 2340.75,
        assigneeId: 'admin-001',
        creatorId: 'tech-001',
      },
      {
        id: 'task-exp-004',
        boardKey: 'EXP',
        columnId: 'col-exp-pending',
        title: 'Team Building Event',
        description: 'Annual team building retreat expenses',
        priority: Priority.LOW,
        tags: ['team', 'event'],
        amount: 8500.0,
        assigneeId: 'buyer-001',
        creatorId: 'admin-001',
      },
    ];

    await Task.insertMany(tasks);
    console.log(`✓ Created ${tasks.length} tasks`);

    // Verify
    const [uCount, bCount, cCount, tCount] = await Promise.all([
      User.countDocuments({}),
      Board.countDocuments({}),
      Column.countDocuments({}),
      Task.countDocuments({}),
    ]);
    console.log('\n✓ Final verification:');
    console.log(`Users: ${uCount}, Boards: ${bCount}, Columns: ${cCount}, Tasks: ${tCount}`);

    console.log('\n🎉 Seed completed successfully!');
    console.log('\nLogin credentials:');
    console.log('Admin: admin@company.com / admin123');
    console.log('Team Lead: lead@company.com / lead123');
    console.log('Alice (Buyer SWIP): buyer@company.com / buyer123');
    console.log('Bob (Buyer GAMBLING): buyer2@company.com / buyer123');
    console.log('Charlie (Designer): designer@company.com / designer123');
    console.log('David (Tech): tech@company.com / tech123');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    try { await mongoose.connection.close(); } catch {}
    process.exit(1);
  }
};

seedData();