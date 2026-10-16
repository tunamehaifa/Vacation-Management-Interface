import bcrypt from "bcryptjs";
import { AppDataSource } from "./data-source";
import { User, UserRole } from "../entities/user.entity";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../entities/vacation-request.entity";

/**
 * Demo data for local development. Safe to re-run: users are upserted by
 * email, sample requests are only added while the table is empty.
 */
const DEMO_PASSWORD = "Password123!";

/** One validator and enough requesters to fill two pages of the Team planning. */
const demoUsers = [
  {
    name: "Victoria Lambert",
    email: "validator@example.com",
    role: UserRole.Validator,
  },
  ...[
    "Alice Martin",
    "Bob Dupont",
    "Chloe Bernard",
    "David Moreau",
    "Emma Laurent",
    "Felix Girard",
    "Grace Fontaine",
    "Hugo Lefevre",
    "Iris Mercier",
    "Jules Rousseau",
    "Karen Blanc",
    "Leo Garnier",
    "Mia Chevalier",
    "Noah Lambert",
  ].map((name) => ({
    name,
    email: `${name.split(" ")[0].toLowerCase()}@example.com`,
    role: UserRole.Requester,
  })),
];

/** "YYYY-MM-DD" for today + `days`, so sample requests never fall in the past. */
const daysFromToday = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const REASONS = [
  "Family trip",
  "Wedding",
  "Hiking",
  null,
  "Moving house",
  "Beach holiday",
  null,
  "Visiting parents",
];
const REJECTION_COMMENTS = [
  "Release week, please pick other dates.",
  "Too many people are away then.",
  "Please split it into two shorter periods.",
];

/**
 * About 35 requests in every status, generated so that one user's requests
 * never overlap (each user's periods are weeks apart):
 * - in 3–6 weeks: one planned vacation per person, so a month on the Team
 *   page has more people than fit on one page;
 * - in 7–14 weeks: a mix of Pending, Approved and Rejected;
 * - in 14–20 weeks: one more Pending request for every other person.
 * Together that is more than one page of Pending requests on the dashboard.
 */
const sampleRequests = (requesters: User[]): Partial<VacationRequest>[] =>
  requesters.flatMap((user, i) => {
    const requests: Partial<VacationRequest>[] = [
      {
        userId: user.id,
        startDate: daysFromToday(20 + i),
        endDate: daysFromToday(23 + i + (i % 4)),
        reason: REASONS[i % REASONS.length],
        status:
          i % 3 === 0
            ? VacationRequestStatus.Pending
            : VacationRequestStatus.Approved,
      },
    ];

    const status = [
      VacationRequestStatus.Pending,
      VacationRequestStatus.Rejected,
      VacationRequestStatus.Approved,
      VacationRequestStatus.Pending,
    ][i % 4];
    requests.push({
      userId: user.id,
      startDate: daysFromToday(50 + i * 3),
      endDate: daysFromToday(52 + i * 3 + (i % 3)),
      reason: REASONS[(i + 3) % REASONS.length],
      status,
      comments:
        status === VacationRequestStatus.Rejected
          ? REJECTION_COMMENTS[i % REJECTION_COMMENTS.length]
          : null,
    });

    if (i % 2 === 0) {
      requests.push({
        userId: user.id,
        startDate: daysFromToday(100 + i * 2),
        endDate: daysFromToday(104 + i * 2),
        reason: REASONS[(i + 5) % REASONS.length],
        status: VacationRequestStatus.Pending,
      });
    }
    return requests;
  });

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  const users = AppDataSource.getRepository(User);
  const requests = AppDataSource.getRepository(VacationRequest);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await users.upsert(
    demoUsers.map((user) => ({ ...user, passwordHash })),
    { conflictPaths: ["email"] },
  );
  console.log(
    `Users: ${demoUsers.length} demo accounts, password "${DEMO_PASSWORD}"`,
  );

  if ((await requests.count()) === 0) {
    const requesters = await users.find({
      where: { role: UserRole.Requester },
      order: { name: "ASC" },
    });
    const rows = sampleRequests(requesters);
    await requests.insert(rows);
    console.log(`Vacation requests: ${rows.length} samples added`);
  } else {
    console.log("Vacation requests: table not empty, samples skipped");
  }

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
