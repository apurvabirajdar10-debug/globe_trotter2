import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { initDatabase, dbOps, hashPassword } from './src/server/db.ts';
import { getDistributedAttractionsForCity } from './src/data/cityAttractions.ts';

dotenv.config();

const app = express();
// Runtime Environment requires dev server to run on port 3000
const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize SQLite Relational Database with tables, foreign keys, and seed data
initDatabase();

// Initialize server-side Google GenAI SDK (gemini-api skill guidelines)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/* ==========================================================================
   AUTHENTICATION & SIGNED HMAC TOKEN LOGIC (Node crypto, 7-day expiry)
   ========================================================================== */
const SESSION_SECRET = process.env.SESSION_SECRET || 'globetrotter_secure_session_secret_2026';

export function createSignedToken(userId: number): string {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const data = `${userId}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifySignedToken(token: string): number | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userIdStr, expiresAtStr, signature] = parts;
  const userId = parseInt(userIdStr, 10);
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(userId) || isNaN(expiresAt)) return null;

  // Verify token expiry
  if (Date.now() > expiresAt) return null;

  // Constant-time HMAC signature verification
  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(`${userIdStr}.${expiresAtStr}`).digest('base64url');
  if (expectedSignature.length !== signature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }
  return userId;
}

export function getUserIdFromReq(req: express.Request): number | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    return verifySignedToken(token);
  }
  return null;
}

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token is missing, invalid, or expired' });
  }
  (req as any).userId = userId;
  next();
}

/* ==========================================================================
   AUTH & USER API ROUTES
   ========================================================================== */

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = dbOps.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const hashed = hashPassword(password);
    if (user.password_hash !== hashed) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const safeUser = dbOps.getUserById(user.id);
    const token = createSignedToken(user.id);

    return res.json({
      user: safeUser,
      token,
      message: 'Logged in successfully',
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to process login' });
  }
});

// POST /api/auth/signup
app.post('/api/auth/signup', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = dbOps.getUserByEmail(trimmedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashed = hashPassword(password);
    const newUser = dbOps.createUser(name.trim(), trimmedEmail, hashed);
    const token = createSignedToken(newUser.id);

    return res.status(201).json({
      user: newUser,
      token,
      message: 'Account created successfully',
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const user = dbOps.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    // Return only a generic message; never reveal password or reset codes
    return res.json({
      message: 'If this email address is registered, password reset instructions have been sent.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process password reset' });
  }
});

// PUT /api/user/profile
app.put('/api/user/profile', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const { name, photo_url, language, currency, saved_destinations, upi_id } = req.body;
    const updated = dbOps.updateUserProfile(userId, { name, photo_url, language, currency, saved_destinations, upi_id });
    return res.json({ user: updated, message: 'Profile updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

/* ==========================================================================
   TRIP API ROUTES
   ========================================================================== */

// GET /api/trips (list all trips for current user - owner or member)
app.get('/api/trips', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const trips = dbOps.getTripsByUser(userId);
    return res.json({ trips });
  } catch (err: any) {
    console.error('Fetch trips error:', err);
    return res.status(500).json({ error: 'Failed to load trips' });
  }
});

// POST /api/trips (create new trip)
app.post('/api/trips', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const { name, start_date, end_date, description, cover_image, budget_total, is_public } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Trip name is required' });
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'End date cannot precede start date' });
    }

    const trip = dbOps.createTrip(userId, {
      name: name.trim(),
      start_date,
      end_date,
      description,
      cover_image,
      budget_total: Number(budget_total) || 0,
      is_public: Boolean(is_public),
    });

    return res.status(201).json({ trip, message: 'Trip created successfully' });
  } catch (err: any) {
    console.error('Create trip error:', err);
    return res.status(500).json({ error: 'Failed to create trip' });
  }
});

// GET /api/trips/:id (get single trip with full stops, activities, expenses, members, settlements)
app.get('/api/trips/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to access this trip' });
    }

    const trip = dbOps.getTripById(id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    return res.json({ trip: { ...trip, current_user_role: role } });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load trip' });
  }
});

// PUT /api/trips/:id (update trip)
app.put('/api/trips/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    const { name, start_date, end_date, description, cover_image, budget_total, is_public } = req.body;

    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'End date cannot precede start date' });
    }

    const updated = dbOps.updateTrip(id, {
      name,
      start_date,
      end_date,
      description,
      cover_image,
      budget_total: budget_total !== undefined ? Number(budget_total) : undefined,
      is_public,
    });

    return res.json({ trip: { ...updated, current_user_role: role }, message: 'Trip updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update trip' });
  }
});

// DELETE /api/trips/:id (owner only)
app.delete('/api/trips/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(id, userId);
    if (!role) return res.status(404).json({ error: 'Trip not found' });
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden: Only the trip owner can delete this trip' });
    }

    dbOps.deleteTrip(id);
    return res.json({ success: true, message: 'Trip and associated stops deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// POST /api/trips/:id/copy (clone/copy trip to current user)
app.post('/api/trips/:id/copy', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to copy this trip' });
    }

    const cloned = dbOps.duplicateTrip(tripId, userId);
    return res.status(201).json({ trip: cloned, message: 'Trip cloned into your itinerary list' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to copy trip' });
  }
});

/* ==========================================================================
   GROUP TRIPS & INVITES API ROUTES
   ========================================================================== */

// POST /api/trips/:id/invite (owner only, returns a join link with a random code, valid 7 days)
app.post('/api/trips/:id/invite', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(id, userId);
    if (!role) return res.status(404).json({ error: 'Trip not found' });
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden: Only the trip owner can invite members' });
    }

    const invite = dbOps.createTripInvite(id, userId);
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const joinUrl = `${protocol}://${host}/?invite=${invite.code}`;

    return res.status(201).json({
      code: invite.code,
      expires_at: invite.expires_at,
      join_url: joinUrl,
      message: 'Invite link created successfully (valid for 7 days)',
    });
  } catch (err: any) {
    console.error('Create invite error:', err);
    return res.status(500).json({ error: 'Failed to create invite link' });
  }
});

// POST /api/invites/:code/join (logged-in user joins as member)
app.post('/api/invites/:code/join', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const { code } = req.params;
    if (!code) return res.status(400).json({ error: 'Invite code is required' });

    const invite = dbOps.getTripInviteByCode(code.trim());
    if (!invite) {
      return res.status(404).json({ error: 'Invalid or non-existent invite code' });
    }

    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This invite link has expired' });
    }

    const currentRole = dbOps.getTripRole(invite.trip_id, userId);
    if (currentRole) {
      const trip = dbOps.getTripById(invite.trip_id);
      return res.status(400).json({
        error: 'You are already a member of this trip',
        trip,
      });
    }

    dbOps.addTripMember(invite.trip_id, userId, 'member');
    const trip = dbOps.getTripById(invite.trip_id);

    return res.json({
      trip: { ...trip, current_user_role: 'member' },
      message: `You have successfully joined "${trip?.name || 'the trip'}"!`,
    });
  } catch (err: any) {
    console.error('Join invite error:', err);
    return res.status(500).json({ error: 'Failed to join trip via invite' });
  }
});

// GET /api/trips/:id/members (returns trip members)
app.get('/api/trips/:id/members', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view members of this trip' });
    }

    const members = dbOps.getTripMembers(id);
    return res.json({ members, current_user_role: role });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load trip members' });
  }
});

// DELETE /api/trips/:id/members/:targetUserId (owner removes someone, or member removes themselves)
app.delete('/api/trips/:id/members/:targetUserId', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.targetUserId, 10);

    if (isNaN(tripId) || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid trip or member ID' });
    }

    const requesterRole = dbOps.getTripRole(tripId, userId);
    if (!requesterRole) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this trip' });
    }

    const targetRole = dbOps.getTripRole(tripId, targetUserId);
    if (!targetRole) {
      return res.status(404).json({ error: 'Member not found on this trip' });
    }

    // Owner cannot leave without deleting the trip
    if (targetRole === 'owner') {
      return res.status(400).json({
        error: 'The trip owner cannot leave the trip. You must delete the trip or transfer ownership.',
      });
    }

    // Only owner can remove others; members can only remove themselves
    if (requesterRole !== 'owner' && userId !== targetUserId) {
      return res.status(403).json({ error: 'Forbidden: Only the trip owner can remove other members' });
    }

    dbOps.removeTripMember(tripId, targetUserId);
    const refreshedTrip = dbOps.getTripById(tripId);

    return res.json({
      success: true,
      trip: refreshedTrip,
      message: userId === targetUserId ? 'You left the trip' : 'Member removed from trip',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to remove member from trip' });
  }
});

/* ==========================================================================
   SETTLEMENTS & DEBT CLEARING API ROUTES
   ========================================================================== */

// GET /api/trips/:id/settlements
app.get('/api/trips/:id/settlements', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view settlements for this trip' });
    }

    const settlements = dbOps.getTripSettlements(id);
    return res.json({ settlements });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load settlements' });
  }
});

// POST /api/trips/:id/settlements (record payment settlement between members)
app.post('/api/trips/:id/settlements', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to record settlements for this trip' });
    }

    const { from_user_id, to_user_id, amount } = req.body;
    if (!from_user_id || !to_user_id || amount === undefined || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Payer, receiver, and a valid positive amount are required' });
    }

    if (Number(from_user_id) === Number(to_user_id)) {
      return res.status(400).json({ error: 'Payer and receiver cannot be the same member' });
    }

    const settlement = dbOps.createSettlement(id, Number(from_user_id), Number(to_user_id), Number(amount));
    const refreshedTrip = dbOps.getTripById(id);

    return res.status(201).json({
      settlement,
      trip: refreshedTrip,
      message: 'Settlement recorded successfully',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record settlement' });
  }
});

/* ==========================================================================
   GROUP VOTING BOARD & PROPOSALS API ROUTES
   ========================================================================== */

// GET /api/trips/:id/proposals
app.get('/api/trips/:id/proposals', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view proposals for this trip' });
    }

    const proposals = dbOps.getProposals(tripId, userId);
    return res.json({ proposals });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// POST /api/trips/:id/proposals (any member can propose)
app.post('/api/trips/:id/proposals', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to propose activities for this trip' });
    }

    const { title, location, category, cost_per_person, notes, stop_id, deadline } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Activity proposal title is required' });
    }

    const proposal = dbOps.createProposal({
      trip_id: tripId,
      stop_id: stop_id ? Number(stop_id) : null,
      title: title.trim(),
      location: location ? location.trim() : null,
      category: category || 'sightseeing',
      cost_per_person: Number(cost_per_person) || 0,
      notes: notes ? notes.trim() : null,
      created_by: userId,
      deadline: deadline || null,
    });

    // Auto-cast creator's vote as 'yes'
    if (proposal) {
      dbOps.castVote(proposal.id, userId, 'yes');
    }

    const updated = dbOps.getProposalById(proposal!.id);
    return res.status(201).json({ proposal: updated, message: 'Activity proposed successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create proposal' });
  }
});

// PUT /api/proposals/:id (edit proposal, reset votes with warning if votes exist)
app.put('/api/proposals/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const propId = parseInt(req.params.id, 10);
    if (isNaN(propId)) return res.status(400).json({ error: 'Invalid proposal ID' });

    const prop = dbOps.getProposalById(propId);
    if (!prop) return res.status(404).json({ error: 'Proposal not found' });

    const role = dbOps.getTripRole(prop.trip_id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this proposal' });
    }

    const { title, location, category, cost_per_person, notes, stop_id, deadline, reset_votes, confirm_reset } = req.body;

    // Edge case: proposal has votes from other members
    const voteCount = prop.votes ? prop.votes.length : 0;
    if (voteCount > 0 && !confirm_reset && reset_votes !== true) {
      return res.status(409).json({
        requires_vote_reset: true,
        vote_count: voteCount,
        message: 'This proposal already has active votes. Editing it will reset all cast votes so everyone can revote. Do you wish to continue?',
      });
    }

    const updated = dbOps.updateProposal(propId, {
      title,
      location,
      category,
      cost_per_person,
      notes,
      stop_id,
      deadline,
    }, voteCount > 0);

    return res.json({ proposal: updated, message: 'Proposal updated successfully and votes reset' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update proposal' });
  }
});

// DELETE /api/proposals/:id
app.delete('/api/proposals/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const propId = parseInt(req.params.id, 10);
    if (isNaN(propId)) return res.status(400).json({ error: 'Invalid proposal ID' });

    const prop = dbOps.getProposalById(propId);
    if (!prop) return res.status(404).json({ error: 'Proposal not found' });

    const role = dbOps.getTripRole(prop.trip_id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this proposal' });
    }

    // Only owner or proposal creator can delete
    if (role !== 'owner' && prop.created_by !== userId) {
      return res.status(403).json({ error: 'Forbidden: Only the proposal creator or trip owner can delete proposals' });
    }

    dbOps.deleteProposal(propId);
    return res.json({ success: true, message: 'Proposal removed' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete proposal' });
  }
});

// POST /api/proposals/:id/vote (cast yes/no/maybe)
app.post('/api/proposals/:id/vote', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const propId = parseInt(req.params.id, 10);
    if (isNaN(propId)) return res.status(400).json({ error: 'Invalid proposal ID' });

    const prop = dbOps.getProposalById(propId);
    if (!prop) return res.status(404).json({ error: 'Proposal not found' });

    const role = dbOps.getTripRole(prop.trip_id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You must be a trip member to vote' });
    }

    if (prop.status !== 'open') {
      return res.status(400).json({ error: `Voting on this proposal is closed (${prop.status})` });
    }

    if (prop.deadline && new Date(prop.deadline).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Voting deadline has already passed for this proposal' });
    }

    const { choice } = req.body;
    if (!['yes', 'no', 'maybe'].includes(choice)) {
      return res.status(400).json({ error: "Choice must be 'yes', 'no', or 'maybe'" });
    }

    const updated = dbOps.castVote(propId, userId, choice as 'yes' | 'no' | 'maybe');
    return res.json({ proposal: updated, message: `Vote recorded as ${choice}` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to cast vote' });
  }
});

// PUT /api/trips/:id/proposals/deadline (owner sets proposal deadline)
app.put('/api/trips/:id/proposals/deadline', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden: Only the trip owner can set voting deadlines' });
    }

    const { deadline } = req.body;
    dbOps.setTripProposalDeadline(tripId, deadline || null);
    const refreshedProposals = dbOps.getProposals(tripId, userId);

    return res.json({ success: true, proposals: refreshedProposals, message: 'Voting deadline updated' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to set deadline' });
  }
});

// POST /api/trips/:id/proposals/close-voting (owner closes voting and adds winners)
app.post('/api/trips/:id/proposals/close-voting', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden: Only the trip owner can close voting and add winning activities' });
    }

    const { target_stop_id, target_date, target_time_slot, winner_proposal_ids } = req.body;
    if (!target_stop_id || !target_date) {
      return res.status(400).json({ error: 'Target stop and date are required to schedule winning activities' });
    }

    if (!Array.isArray(winner_proposal_ids) || winner_proposal_ids.length === 0) {
      return res.status(400).json({ error: 'At least one winning proposal ID must be specified' });
    }

    const result = dbOps.closeTripVotingAndAddWinners({
      trip_id: tripId,
      winner_proposal_ids: winner_proposal_ids.map(Number),
      target_stop_id: Number(target_stop_id),
      target_date,
      target_time_slot: target_time_slot || 'morning',
    });

    const refreshedProposals = dbOps.getProposals(tripId, userId);

    return res.json({
      success: true,
      trip: result.trip,
      proposals: refreshedProposals,
      addedActivities: result.addedActivities,
      message: `Voting closed! Added ${result.addedActivities.length} winning activities to your itinerary schedule.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to close voting and add winners' });
  }
});

// GET /api/trips/slug/:slug (public read-only itinerary)
app.get('/api/trips/slug/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const trip = dbOps.getTripBySlug(slug);
    if (!trip) {
      return res.status(404).json({ error: 'Public trip not found' });
    }
    return res.json({ trip });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load public trip' });
  }
});

/* ==========================================================================
   STOPS & ITINERARY BUILDER API ROUTES
   ========================================================================== */

// POST /api/trips/:id/stops (add city stop)
app.post('/api/trips/:id/stops', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    const { city_name, country, start_date, end_date, transport_mode, transport_notes, notes, order_index } = req.body;

    if (!city_name || !country || !start_date || !end_date) {
      return res.status(400).json({ error: 'City name, country, arrival and departure dates are required' });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'Departure date cannot precede arrival date' });
    }

    const stop = dbOps.createStop(tripId, {
      city_name: city_name.trim(),
      country: country.trim(),
      start_date,
      end_date,
      transport_mode,
      transport_notes,
      notes,
      order_index,
    });

    // Automatically populate top must-visit spots and key attractions for this city,
    // intelligently distributed across the specified number of days for this stop
    try {
      const sDate = new Date(start_date + 'T00:00:00');
      const eDate = new Date(end_date + 'T00:00:00');
      const dayCount = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      const attractions = getDistributedAttractionsForCity(city_name.trim(), country.trim(), dayCount);

      attractions.forEach((attr, idx) => {
        // Distribute activities across the days of this stop
        const dayOffset = Math.min(dayCount - 1, Math.floor(idx / 2));
        const actDateObj = new Date(sDate);
        actDateObj.setDate(actDateObj.getDate() + dayOffset);
        const dateStr = actDateObj.toISOString().split('T')[0];

        dbOps.createActivity({
          stop_id: stop.id,
          trip_id: tripId,
          title: attr.title,
          description: attr.description,
          date: dateStr,
          time_slot: attr.time_slot,
          cost: attr.cost,
          category: attr.category,
          duration_hours: attr.duration_hours,
          location: attr.location,
          booking_status: 'planned',
          order_index: idx,
        });

        // Record expense for non-free attractions to keep budget sync accurate
        if (attr.cost > 0) {
          dbOps.createExpense({
            trip_id: tripId,
            stop_id: stop.id,
            title: `${attr.title} (Ticket/Pass)`,
            category: 'activities',
            amount: attr.cost,
            currency: 'INR',
            date: dateStr,
            paid_by: 'Alex',
            paid_by_user_id: userId,
            notes: `Auto-scheduled attraction in ${city_name}`,
          });
        }
      });
    } catch (attrErr) {
      console.warn('Could not auto-populate city attractions:', attrErr);
    }

    const refreshedTrip = dbOps.getTripById(tripId);
    return res.status(201).json({ stop, trip: refreshedTrip, message: `Added ${city_name} to itinerary with scheduled attractions` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add stop' });
  }
});

// PUT /api/trips/:id/stops/reorder (reorder stops)
app.put('/api/trips/:id/stops/reorder', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    const { orderedStopIds } = req.body;

    if (!Array.isArray(orderedStopIds)) {
      return res.status(400).json({ error: 'orderedStopIds array required' });
    }

    dbOps.reorderStops(tripId, orderedStopIds);
    const refreshedTrip = dbOps.getTripById(tripId);
    return res.json({ trip: refreshedTrip, message: 'Stops reordered successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reorder stops' });
  }
});

// PUT /api/stops/:stopId (update stop details)
app.put('/api/stops/:stopId', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const stopId = parseInt(req.params.stopId, 10);
    if (isNaN(stopId)) return res.status(400).json({ error: 'Invalid stop ID' });

    const stop = dbOps.getStopById(stopId);
    if (!stop) return res.status(404).json({ error: 'Stop not found' });

    const role = dbOps.getTripRole(stop.trip_id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    const updated = dbOps.updateStop(stopId, req.body);
    const refreshedTrip = dbOps.getTripById(updated.trip_id);
    return res.json({ stop: updated, trip: refreshedTrip, message: 'Stop updated' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update stop' });
  }
});

// DELETE /api/stops/:stopId (delete city stop)
app.delete('/api/stops/:stopId', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const stopId = parseInt(req.params.stopId, 10);
    if (isNaN(stopId)) return res.status(400).json({ error: 'Invalid stop ID' });

    const stop = dbOps.getStopById(stopId);
    if (!stop) return res.status(404).json({ error: 'Stop not found' });

    const role = dbOps.getTripRole(stop.trip_id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    dbOps.deleteStop(stopId);
    return res.json({ success: true, message: 'Stop deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete stop' });
  }
});

/* ==========================================================================
   ACTIVITIES API ROUTES
   ========================================================================== */

// POST /api/trips/:id/activities (add activity to stop)
app.post('/api/trips/:id/activities', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    const { stop_id, title, description, date, time_slot, cost, category, duration_hours, location, booking_status } = req.body;

    if (!stop_id || !title || !date) {
      return res.status(400).json({ error: 'Stop, title, and date are required' });
    }

    const activity = dbOps.createActivity({
      stop_id: Number(stop_id),
      trip_id: tripId,
      title: title.trim(),
      description,
      date,
      time_slot,
      cost: Number(cost) || 0,
      category,
      duration_hours: Number(duration_hours) || 2,
      location,
      booking_status,
    });

    const refreshedTrip = dbOps.getTripById(tripId);
    return res.status(201).json({ activity, trip: refreshedTrip, message: 'Activity added' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add activity' });
  }
});

// PUT /api/activities/:activityId
app.put('/api/activities/:activityId', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.activityId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid activity ID' });

    const activity = dbOps.getActivityById(id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const role = dbOps.getTripRole(activity.trip_id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    const updated = dbOps.updateActivity(id, req.body);
    const refreshedTrip = dbOps.getTripById(updated.trip_id);
    return res.json({ activity: updated, trip: refreshedTrip, message: 'Activity updated' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update activity' });
  }
});

// DELETE /api/activities/:activityId
app.delete('/api/activities/:activityId', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.activityId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid activity ID' });

    const activity = dbOps.getActivityById(id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const role = dbOps.getTripRole(activity.trip_id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    dbOps.deleteActivity(id);
    return res.json({ success: true, message: 'Activity deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete activity' });
  }
});

/* ==========================================================================
   EXPENSES & BUDGET API ROUTES
   ========================================================================== */

// GET /api/trips/:id/expenses (get summary & list)
app.get('/api/trips/:id/expenses', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to access this trip' });
    }

    const trip = dbOps.getTripById(tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const summary = dbOps.getExpensesSummary(tripId);
    return res.json({
      summary,
      budget_total: trip?.budget_total || 0,
      expenses: trip?.expenses || [],
      members: trip?.members || [],
      settlements: trip?.settlements || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load expenses' });
  }
});

// POST /api/trips/:id/expenses (record expense with optional group splits)
app.post('/api/trips/:id/expenses', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    const { stop_id, title, category, amount, currency, date, paid_by, paid_by_user_id, notes, splits } = req.body;

    if (!title || !category || amount === undefined || !date) {
      return res.status(400).json({ error: 'Title, category, amount, and date are required' });
    }

    const expense = dbOps.createExpense({
      trip_id: tripId,
      stop_id: stop_id ? Number(stop_id) : null,
      title: title.trim(),
      category,
      amount: Number(amount) || 0,
      currency: currency || 'INR',
      date,
      paid_by: paid_by || '',
      paid_by_user_id: paid_by_user_id ? Number(paid_by_user_id) : userId,
      notes,
      splits: Array.isArray(splits) ? splits : undefined,
    });

    const refreshedTrip = dbOps.getTripById(tripId);
    const summary = dbOps.getExpensesSummary(tripId);

    return res.status(201).json({
      expense,
      trip: refreshedTrip,
      summary,
      message: 'Expense recorded successfully',
    });
  } catch (err: any) {
    console.error('Create expense error:', err);
    return res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PUT /api/expenses/:id
app.put('/api/expenses/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid expense ID' });

    const expense = dbOps.getExpenseById(id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const role = dbOps.getTripRole(expense.trip_id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    const updated = dbOps.updateExpense(id, req.body);
    const summary = dbOps.getExpensesSummary(updated.trip_id);
    const refreshedTrip = dbOps.getTripById(updated.trip_id);

    return res.json({ expense: updated, trip: refreshedTrip, summary, message: 'Expense updated' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid expense ID' });

    const expense = dbOps.getExpenseById(id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const role = dbOps.getTripRole(expense.trip_id, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this trip' });
    }

    dbOps.deleteExpense(id);
    const refreshedTrip = dbOps.getTripById(expense.trip_id);

    return res.json({ success: true, trip: refreshedTrip, message: 'Expense deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete expense' });
  }
});

/* ==========================================================================
   BOOKINGS & PASSES CRUD API ROUTES
   ========================================================================== */

// GET /api/trips/:id/bookings
app.get('/api/trips/:id/bookings', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view bookings for this trip' });
    }

    const bookings = dbOps.getBookings(tripId);
    return res.json({ bookings });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch trip bookings' });
  }
});

// GET /api/bookings (all bookings for the current active traveler)
app.get('/api/bookings', requireAuth, (_req, res) => {
  try {
    const bookings = dbOps.getBookings();
    return res.json({ bookings });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST /api/trips/:id/bookings (save booking, optional linked expense)
app.post('/api/trips/:id/bookings', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const tripId = parseInt(req.params.id, 10);
    if (isNaN(tripId)) return res.status(400).json({ error: 'Invalid trip ID' });

    const role = dbOps.getTripRole(tripId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to add bookings to this trip' });
    }

    const {
      type,
      provider,
      reference_number,
      pnr_number,
      origin,
      destination,
      start_datetime,
      end_datetime,
      passengers,
      amount,
      currency,
      source,
      status,
      category_label,
      details,
      qr_data,
      notes,
      stop_id,
      add_expense,
    } = req.body;

    if (!type || !provider || !reference_number || !destination || !start_datetime) {
      return res.status(400).json({ error: 'Type, provider, reference number, destination, and start datetime are required' });
    }

    let linkedExpenseId: number | null = null;
    const bookingAmount = Number(amount) || 0;

    // Optional linked expense creation in trip budget
    if (add_expense && bookingAmount > 0) {
      try {
        let expenseCat: 'transport' | 'stay' | 'activities' | 'miscellaneous' = 'transport';
        if (type === 'stay') expenseCat = 'stay';
        else if (type === 'activity' || type === 'attraction') expenseCat = 'activities';
        else if (type === 'cab' || type === 'vehicle' || type === 'flight' || type === 'train' || type === 'bus') expenseCat = 'transport';

        const travelDate = start_datetime.split('T')[0] || start_datetime.split(' ')[0] || new Date().toISOString().split('T')[0];
        const newExp = dbOps.createExpense(tripId, {
          title: `Booking: ${provider} (${reference_number})`,
          category: expenseCat,
          amount: bookingAmount,
          currency: currency || 'INR',
          date: travelDate,
          paid_by_user_id: userId,
          stop_id: stop_id ? Number(stop_id) : null,
          notes: `Linked Booking Ref: ${reference_number}. Auto-generated receipt.`,
        });
        linkedExpenseId = newExp.id;
      } catch (expErr) {
        console.warn('Could not auto-create linked expense for booking:', expErr);
      }
    }

    const booking = dbOps.createBooking({
      trip_id: tripId,
      stop_id: stop_id ? Number(stop_id) : null,
      type,
      provider: provider.trim(),
      reference_number: reference_number.trim(),
      pnr_number: pnr_number ? pnr_number.trim() : null,
      origin: origin ? origin.trim() : null,
      destination: destination.trim(),
      start_datetime,
      end_datetime: end_datetime || null,
      passengers: passengers || '1 Traveler',
      amount: bookingAmount,
      currency: currency || 'INR',
      source: source || 'imported',
      status: status || 'Confirmed',
      category_label: category_label || provider.trim(),
      details: details || {},
      qr_data: qr_data || `GT-BOOKING|${reference_number}|${bookingAmount}|${destination}`,
      notes: notes || null,
      expense_id: linkedExpenseId,
    });

    const refreshedTrip = dbOps.getTripById(tripId);
    return res.status(201).json({
      booking,
      trip: refreshedTrip,
      message: 'Booking saved successfully',
    });
  } catch (err: any) {
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Failed to save booking' });
  }
});

// DELETE /api/bookings/:id
app.delete('/api/bookings/:id', requireAuth, (req, res) => {
  try {
    const userId = (req as any).userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid booking ID' });

    const booking = dbOps.getBookingById(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.trip_id) {
      const role = dbOps.getTripRole(booking.trip_id, userId);
      if (!role) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to delete bookings for this trip' });
      }
    }

    dbOps.deleteBooking(id);
    return res.json({ success: true, message: 'Booking removed successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete booking' });
  }
});

/* ==========================================================================
   CITY & ACTIVITY CATALOG SEARCH API
   ========================================================================== */

// GET /api/catalog/search
app.get('/api/catalog/search', (req, res) => {
  try {
    const { query, country, category, cost_index, max_duration, scope } = req.query;
    const items = dbOps.searchCatalog({
      query: query ? String(query) : undefined,
      country: country ? String(country) : undefined,
      category: category ? String(category) : undefined,
      cost_index: cost_index ? String(cost_index) : undefined,
      max_duration: max_duration ? parseFloat(String(max_duration)) : undefined,
      scope: scope === 'national' || scope === 'international' ? scope : undefined,
    });
    const countries = dbOps.getCatalogCountries(scope ? String(scope) : undefined);
    return res.json({ items, countries, total: items.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to search catalog' });
  }
});

/* ==========================================================================
   AI / GENAI INTEGRATION ROUTES (Using gemini-3.8-flash)
   ========================================================================== */

// 1. POST /api/ai/generate-itinerary
app.post('/api/ai/generate-itinerary', async (req, res) => {
  try {
    const { destination, duration_days, budget_level, interests, travel_party, start_date } = req.body;

    if (!destination) {
      return res.status(400).json({ error: 'Destination or travel goal is required' });
    }

    const duration = parseInt(duration_days, 10) || 7;
    const effectiveStart = start_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const prompt = `
Create a realistic, exciting, and balanced multi-city travel itinerary for:
- Destination(s): ${destination}
- Duration: ${duration} days
- Target start date: ${effectiveStart}
- Budget Style: ${budget_level || 'Moderate'}
- Travel Party: ${travel_party || 'Couple'}
- Specific Interests & Vibe: ${interests || 'Culture, local cuisine, scenic walks, landmarks'}

Requirements:
- Plan 2 to 4 interconnected city stops within this duration.
- For each stop, assign realistic arrival and departure dates starting sequentially from ${effectiveStart}.
- For each stop, recommend 2 to 3 distinct activities per day categorized by time_slot (morning, afternoon, evening), realistic costs in USD, duration, and category (sightseeing, food, culture, adventure, relaxation).
- Specify transport modes between consecutive cities (train, flight, car, bus).
- Provide an estimated total budget target.
`;

    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction: 'You are an elite travel concierge crafting world-class multi-city travel itineraries. Return ONLY valid JSON matching the requested structure.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                estimated_budget: { type: Type.NUMBER },
                cover_image: { type: Type.STRING },
                stops: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      city_name: { type: Type.STRING },
                      country: { type: Type.STRING },
                      start_date: { type: Type.STRING },
                      end_date: { type: Type.STRING },
                      transport_mode: { type: Type.STRING },
                      transport_notes: { type: Type.STRING },
                      activities: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            date: { type: Type.STRING },
                            time_slot: { type: Type.STRING },
                            category: { type: Type.STRING },
                            cost: { type: Type.NUMBER },
                            duration_hours: { type: Type.NUMBER },
                            location: { type: Type.STRING },
                          },
                          required: ['title', 'date', 'time_slot', 'cost', 'category'],
                        },
                      },
                    },
                    required: ['city_name', 'country', 'start_date', 'end_date', 'activities'],
                  },
                },
              },
              required: ['name', 'description', 'estimated_budget', 'stops'],
            },
          },
        });

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (!parsed.cover_image) {
            parsed.cover_image = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';
          }
          return res.json({ itinerary: parsed });
        }
      } catch (geminiErr: any) {
        console.warn('Gemini generateContent error, activating fallback generator:', geminiErr?.message);
      }
    }

    // High quality dynamic fallback generator if Gemini is unavailable
    const fallback = generateSmartFallbackItinerary(destination, duration, effectiveStart, budget_level, interests);
    return res.json({ itinerary: fallback, note: 'Generated with Globe Trotter itinerary engine' });
  } catch (err: any) {
    console.error('AI generate itinerary error:', err);
    return res.status(500).json({ error: 'Failed to generate itinerary. Please try again.' });
  }
});

// 2. POST /api/ai/optimize-itinerary
app.post('/api/ai/optimize-itinerary', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { trip_id } = req.body;
    if (!trip_id) return res.status(400).json({ error: 'trip_id is required' });

    const trip = dbOps.getTripById(Number(trip_id));
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to access this trip' });
    }

    const summaryData = {
      name: trip.name,
      dates: `${trip.start_date} to ${trip.end_date}`,
      budget: trip.budget_total,
      total_spent: trip.total_spent,
      stops: trip.stops?.map((s: any) => ({
        city: s.city_name,
        country: s.country,
        dates: `${s.start_date} to ${s.end_date}`,
        activitiesCount: s.activities?.length || 0,
        activities: s.activities?.map((a: any) => `${a.title} (₹${a.cost})`),
      })),
      expenses: trip.expenses?.map((e: any) => `${e.title}: ₹${e.amount} (${e.category})`),
    };

    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `
Analyze this multi-city travel itinerary for efficiency, budget optimization, sequencing, and pacing:
${JSON.stringify(summaryData, null, 2)}

Provide an evaluation in JSON:
- score: overall score 0-100 (e.g., 85)
- summary: 2-3 sentence assessment of the itinerary
- savings_potential: estimated potential savings in INR (₹)
- suggestions: array of items, each with:
  - category: "sequence" | "budget" | "pacing" | "logistics"
  - title: short headline (under 8 words)
  - description: clear, helpful rationale
  - impact: "high" | "medium" | "low"
  - actionable_tip: practical tip the traveler can apply
`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction: 'You are an expert travel optimizer. Return ONLY valid JSON.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                summary: { type: Type.STRING },
                savings_potential: { type: Type.NUMBER },
                suggestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category: { type: Type.STRING },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      impact: { type: Type.STRING },
                      actionable_tip: { type: Type.STRING },
                    },
                    required: ['category', 'title', 'description', 'impact'],
                  },
                },
              },
              required: ['score', 'summary', 'suggestions'],
            },
          },
        });

        const text = response.text;
        if (text) {
          return res.json({ optimization: JSON.parse(text) });
        }
      } catch (geminiErr: any) {
        console.warn('Gemini optimization error, using fallback:', geminiErr?.message);
      }
    }

    // Fallback optimization analysis
    const totalSpent = trip.total_spent || 0;
    const budget = trip.budget_total || 3000;
    const isOver = totalSpent > budget;
    const stopCount = trip.stops?.length || 1;

    const fallbackResult = {
      score: isOver ? 74 : (stopCount >= 2 ? 91 : 82),
      summary: `Your ${trip.name} itinerary has strong destination selection with ${stopCount} stop(s). ${isOver ? 'Expenses currently exceed the allocated budget, so cost adjustments are advised.' : 'Pacing and spending are well balanced.'}`,
      savings_potential: Math.max(0, Math.round(budget * 0.12)),
      suggestions: [
        {
          category: 'budget',
          title: 'Bundle City Museum & Transit Passes',
          description: 'Purchasing combined city passes for museums and metro rides saves up to 25% compared to individual tickets.',
          impact: 'high',
          actionable_tip: 'Check official tourism cards (e.g. Paris Museum Pass or Roma Pass) before visiting key sites.',
        },
        {
          category: 'pacing',
          title: 'Schedule a Free Afternoon Between Transit Days',
          description: 'Consecutive travel days can cause traveler fatigue. Leaving day-gaps keeps exploration relaxed.',
          impact: 'medium',
          actionable_tip: 'Keep the first afternoon in each new stop free for casual neighborhood walks and dining.',
        },
        {
          category: 'sequence',
          title: 'Align High-Cost Activities to Off-Peak Hours',
          description: 'Morning and twilight ticket slots often offer reduced crowding and discounted rates.',
          impact: 'medium',
          actionable_tip: 'Book primary sights at early morning openings or after 5 PM.',
        },
        {
          category: 'logistics',
          title: 'Reserve Intercity Rail Seats in Advance',
          description: 'High-speed rail fares increase significantly closer to departure dates.',
          impact: 'high',
          actionable_tip: 'Lock in train reservations at least 3 weeks prior to travel.',
        },
      ],
    };

    return res.json({ optimization: fallbackResult });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to optimize itinerary' });
  }
});

// 3. POST /api/ai/trip-chat
app.post('/api/ai/trip-chat', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { trip_id, message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    let tripContext = '';
    if (trip_id) {
      const trip = dbOps.getTripById(Number(trip_id));
      if (!trip) return res.status(404).json({ error: 'Trip not found' });
      if (trip.user_id !== userId) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to access this trip' });
      }
      tripContext = `Current Trip Details:
- Name: ${trip.name}
- Dates: ${trip.start_date} to ${trip.end_date}
- Budget: ₹${trip.budget_total} (Spent: ₹${trip.total_spent || 0})
- Stops: ${trip.stops?.map((s: any) => `${s.city_name}, ${s.country} (${s.start_date} to ${s.end_date})`).join(' -> ')}
- Activities: ${trip.stops?.flatMap((s: any) => s.activities?.map((a: any) => `${a.title} in ${s.city_name}`)).join(', ')}`;
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ reply: 'AI is unavailable right now.' });
    }

    try {
      const systemPrompt = `You are Globe Trotter AI, a friendly, knowledgeable concierge specialized in multi-city travel.
Help the traveler with personalized suggestions, packing recommendations, local dining tips, transit guidance, and day-planning.
Keep answers concise, inspiring, and formatted with clean bullet points when helpful.

${tripContext}`;

      const contents: any[] = [];
      if (Array.isArray(history)) {
        for (const item of history.slice(-6)) {
          contents.push({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.content }],
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        },
      });

      const reply = response.text || 'I am ready to help you plan every detail of your journey!';
      return res.json({ reply });
    } catch (geminiErr: any) {
      console.warn('Gemini chat error:', geminiErr?.message);
      return res.json({ reply: 'AI is unavailable right now.' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// 4. POST /api/ai/extract-booking (AI Booking Extraction from text, screenshot, or PDF)
app.post('/api/ai/extract-booking', requireAuth, async (req, res) => {
  try {
    const { text, file_base64, file_mime_type, trip_id } = req.body;

    if (!text && !file_base64) {
      return res.status(400).json({ error: 'Please provide booking confirmation text or an uploaded file (PDF / Screenshot).' });
    }

    // Edge case: file size exceeds 5MB
    if (file_base64) {
      const rawBase64 = file_base64.replace(/^data:[^;]+;base64,/, '');
      const approxBytes = Math.ceil((rawBase64.length * 3) / 4);
      if (approxBytes > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Uploaded file exceeds the 5 MB maximum limit. Please upload a smaller file.' });
      }
    }

    // Edge case: missing API key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY to use AI booking extraction.',
      });
    }

    const EXTRACTION_SYSTEM_INSTRUCTION = `You are an expert multi-modal travel reservation parser and OCR engine.
Extract all travel, transit, stay, vehicle, or activity reservations from the provided text or document.
The confirmation may contain multiple bookings (e.g. connecting flights, return trips, hotel vouchers, train reservations, or museum tickets).
Extract each booking as an object with value and a confidence score between 0.0 and 1.0:
- type: exactly one of "flight", "train", "bus", "stay", "cab", "activity"
- provider: company/airline/hotel/railway name (e.g., "IndiGo", "IRCTC", "Marriott", "Uber")
- reference_number: PNR, confirmation number, e-ticket reference
- origin: departure city/station/airport
- destination: arrival city/station/hotel/attraction
- start_datetime: date & time in "YYYY-MM-DD HH:mm" format (e.g. "2026-06-12 06:00")
- end_datetime: arrival or check-out date & time in "YYYY-MM-DD HH:mm" format
- passenger_names: array of traveler names
- amount: total price paid as a positive number
- currency: currency code (e.g. "INR", "USD", "EUR")
- notes: seat, cabin class, room category, or slot details

Confidence Scoring Guidelines:
- 0.90 to 1.0: Explicitly printed and crystal clear
- 0.60 to 0.89: Inferred with high certainty
- 0.00 to 0.59: Partially ambiguous, low legibility, or estimated
Return ONLY valid JSON matching the strict schema.`;

    const bookingSchema = {
      type: Type.OBJECT,
      properties: {
        bookings: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              provider: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              reference_number: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              origin: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              destination: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              start_datetime: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              end_datetime: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              passenger_names: {
                type: Type.OBJECT,
                properties: {
                  value: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              amount: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.NUMBER },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              currency: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              notes: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
            },
            required: [
              'type',
              'provider',
              'reference_number',
              'origin',
              'destination',
              'start_datetime',
              'passenger_names',
              'amount',
              'currency',
            ],
          },
        },
      },
      required: ['bookings'],
    };

    const callGemini = async (extraPromptHint = '') => {
      const parts: any[] = [];

      if (text) {
        parts.push({
          text: `Booking confirmation text to parse:\n\n${text}\n${extraPromptHint}`,
        });
      }

      if (file_base64) {
        const cleanBase64 = file_base64.replace(/^data:[^;]+;base64,/, '');
        const mime = file_mime_type || (file_base64.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg');
        parts.push({
          inlineData: {
            mimeType: mime,
            data: cleanBase64,
          },
        });
        parts.push({
          text: `Please parse all travel bookings visible in this uploaded confirmation file.${extraPromptHint ? `\n${extraPromptHint}` : ''}`,
        });
      }

      return ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: bookingSchema,
        },
      });
    };

    // First attempt
    let rawText = '';
    let parsed: any = null;

    try {
      const response = await callGemini();
      rawText = response.text || '';
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.warn('Initial JSON parse failed, retrying once as required...');
      try {
        const retryResponse = await callGemini('IMPORTANT: Please ensure the response strictly adheres to the JSON schema without any surrounding markdown commentary.');
        rawText = retryResponse.text || '';
        parsed = JSON.parse(rawText);
      } catch (retryErr) {
        return res.status(422).json({
          error: 'Could not parse confirmation document. The file may be unreadable, corrupted, or unsupported. Please verify and try again.',
        });
      }
    }

    if (!parsed || !Array.isArray(parsed.bookings) || parsed.bookings.length === 0) {
      return res.status(422).json({
        error: 'No travel or stay bookings could be detected in the provided confirmation. Please check the text or image and try again.',
      });
    }

    // Check for duplicate reference numbers across existing trip bookings
    const tripIdNum = trip_id ? Number(trip_id) : undefined;
    const enrichedBookings = parsed.bookings.map((item: any) => {
      const ref = item.reference_number?.value ? String(item.reference_number.value).trim() : '';
      let isDuplicate = false;
      let duplicateWarning = '';

      if (ref) {
        const existing = dbOps.getBookingByReference(ref, tripIdNum);
        if (existing) {
          isDuplicate = true;
          duplicateWarning = `A booking with reference number "${ref}" is already registered in this trip (${existing.provider} - ${existing.destination}).`;
        }
      }

      return {
        ...item,
        is_duplicate: isDuplicate,
        duplicate_warning: duplicateWarning,
      };
    });

    return res.json({
      bookings: enrichedBookings,
      total_found: enrichedBookings.length,
      extraction_prompt_summary: 'Gemini 3.8 Flash structured multi-modal parser with per-field confidence metrics',
    });
  } catch (err: any) {
    console.error('Extract booking error:', err);
    return res.status(500).json({ error: 'Failed to process booking extraction. Please try again.' });
  }
});

// Helper for dynamic offline itinerary creation
function generateSmartFallbackItinerary(destination: string, duration: number, startDateStr: string, budgetStyle: string, interests: string) {
  const start = new Date(startDateStr);
  const addDays = (d: Date, n: number) => {
    const res = new Date(d);
    res.setDate(res.getDate() + n);
    return res.toISOString().split('T')[0];
  };

  // Determine cities based on query keywords
  let stopsData: any[] = [];
  const lower = destination.toLowerCase();

  if (lower.includes('japan') || lower.includes('tokyo')) {
    stopsData = [
      { city: 'Tokyo', country: 'Japan', days: Math.ceil(duration * 0.45), mode: 'flight', activities: ['Shinjuku Gyoen National Garden', 'TeamLab Planets Immersive Art', 'Shibuya Crossing & Izakaya Alley'] },
      { city: 'Kyoto', country: 'Japan', days: Math.floor(duration * 0.35), mode: 'train', activities: ['Fushimi Inari Early Morning Walk', 'Gion Historic Teahouse District', 'Arashiyama Bamboo Grove'] },
      { city: 'Osaka', country: 'Japan', days: Math.max(1, duration - Math.ceil(duration * 0.45) - Math.floor(duration * 0.35)), mode: 'train', activities: ['Osaka Castle & Park', 'Dotonbori Street Food Tour'] },
    ];
  } else if (lower.includes('italy') || lower.includes('rome')) {
    stopsData = [
      { city: 'Rome', country: 'Italy', days: Math.ceil(duration * 0.4), mode: 'flight', activities: ['Colosseum & Forum Exploration', 'Trevi Fountain & Spanish Steps', 'Trastevere Pasta Tasting'] },
      { city: 'Florence', country: 'Italy', days: Math.floor(duration * 0.35), mode: 'train', activities: ['Uffizi Gallery Renaissance Art', 'Duomo Terraces Climb', 'Ponte Vecchio Sunset Gelato'] },
      { city: 'Venice', country: 'Italy', days: Math.max(1, duration - Math.ceil(duration * 0.4) - Math.floor(duration * 0.35)), mode: 'train', activities: ['Grand Canal Vaporetto Ride', 'St. Mark’s Basilica & Doge Palace'] },
    ];
  } else {
    // Generic multi-city trip adapted to the user input
    const parts = destination.split(/[,&/]/).map(s => s.trim()).filter(Boolean);
    const mainCity = parts[0] || 'Paris';
    const secondCity = parts[1] || 'Amsterdam';

    stopsData = [
      { city: mainCity, country: 'Destination Area', days: Math.ceil(duration / 2), mode: 'flight', activities: ['Historic City Center Walking Tour', 'Iconic Museum & Landmark Highlights', 'Traditional Culinary Dinner'] },
      { city: secondCity, country: 'Destination Area', days: Math.floor(duration / 2), mode: 'train', activities: ['Scenic Canal & Waterfront Stroll', 'Artisanal Neighborhood Market Crawl', 'Sunset Panoramic Viewpoint'] },
    ];
  }

  let curDate = start;
  const stops: any[] = [];
  let dayOffset = 0;

  for (let i = 0; i < stopsData.length; i++) {
    const s = stopsData[i];
    const stopStart = addDays(start, dayOffset);
    dayOffset += s.days;
    const stopEnd = addDays(start, dayOffset);

    const activities = s.activities.map((actTitle: string, actIdx: number) => ({
      title: actTitle,
      description: `Signature experience in ${s.city} tailored for ${interests || 'discovery'}.`,
      date: addDays(new Date(stopStart), Math.min(actIdx, s.days - 1)),
      time_slot: actIdx === 0 ? 'morning' : (actIdx === 1 ? 'afternoon' : 'evening'),
      category: actIdx === 0 ? 'sightseeing' : (actIdx === 1 ? 'culture' : 'food'),
      cost: actIdx === 1 ? 35 : (actIdx === 2 ? 45 : 15),
      duration_hours: 2.5,
      location: s.city,
    }));

    stops.push({
      city_name: s.city,
      country: s.country,
      start_date: stopStart,
      end_date: stopEnd,
      transport_mode: s.mode,
      transport_notes: i > 0 ? `Transit from ${stopsData[i - 1].city}` : 'Arrival via primary gateway',
      activities,
    });
  }

  return {
    name: `${destination} Explorer`,
    description: `A thoughtfully planned ${duration}-day journey focusing on ${interests || 'highlights, local flavors, and memorable sights'}.`,
    estimated_budget: duration * (budgetStyle === 'Luxury' ? 380 : (budgetStyle === 'Budget' ? 120 : 220)),
    cover_image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
    stops,
  };
}

/* ==========================================================================
   FRONTEND VITE & STATIC SERVING INTEGRATION
   ========================================================================== */

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Globe Trotter server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
