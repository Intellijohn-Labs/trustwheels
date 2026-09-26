import { DEMO_USERS } from "./rbac";
import { SUPERVISORS, TRANSFER_STEPS } from "./masters";
import type { Delivery, JobItem, Vehicle } from "./types";

/*
 * Demo vehicles covering every workflow step, timed relative to "now" so the SLA
 * indicators (transit breach, RED flag, Code Red, payment due) always have examples.
 * Bump VEHICLE_SEED_VERSION when this changes; stored demo records are then replaced.
 */
export const VEHICLE_SEED_VERSION = 5;

const HOUR = 3_600_000;
const U = DEMO_USERS;

type Spec = Pick<Vehicle, "registrationNo" | "make" | "model" | "variant" | "year" | "engineCc" | "odometerKm" | "colour" | "owners" | "branchId" | "source"> & {
  value: number;
  seller: string;
  stage: number;
  /** hours ago, keyed by milestone */
  t: { created: number; verified?: number; purchase?: number; approved?: number; paid?: number; dispatched?: number; received?: number; reconDone?: number; gate?: number; booked?: number; sold?: number; released?: number; delivered?: number };
  supervisor?: string;
  items?: [JobItem["kind"], string, number][];
  price?: number;
  deductions?: number;
  customer?: [string, string];
  booking?: number;
  salePrice?: number;
  transferDone?: number; // how many checklist steps are done
  fee?: "requested" | "approved" | "paid";
  docsVerified?: boolean;
};

export function seedVehicles(now = Date.now()): Vehicle[] {
  const ago = (h: number) => new Date(now - h * HOUR).toISOString();
  const signed = (h: number, by: string) => ({ at: ago(h), by });
  let stock = 1040;

  const build = (n: number, s: Spec): Vehicle => {
    const t = s.t;
    const milestones: [number, number | undefined][] = [
      [1, t.created],
      [2, t.created - 1],
      [3, t.verified],
      [4, t.purchase ?? t.verified],
      [5, t.dispatched],
      [6, t.dispatched],
      [7, t.received],
      [8, t.received],
      [9, t.gate],
      [10, t.gate],
      [11, t.booked ?? t.sold],
      [12, t.delivered],
    ];
    const stageHistory = milestones
      .filter(([stage]) => stage <= s.stage)
      .map(([stage, h], i, all) => ({ stage, at: ago(h ?? (all[i - 1]?.[1] ?? t.created) - 0.5) }));

    const net = (s.value - (s.deductions ?? 0)) * 100;
    const delivery: Delivery | undefined = t.sold
      ? {
          transfer: Object.fromEntries(
            TRANSFER_STEPS.slice(0, s.transferDone ?? 0).map((step, i) => [step.id, signed(t.sold! - 6 - i * 10, U.sales_executive.name)]),
          ),
          transferFeePaise: s.fee ? 250000 : undefined,
          feePayment: s.fee
            ? {
                status: s.fee,
                requested: signed(t.sold - 4, U.sales_executive.name),
                approved: s.fee !== "requested" ? signed(t.sold - 8, U.central_accountant.name) : undefined,
                paid: s.fee === "paid" ? signed(t.sold - 10, U.central_accountant.name) : undefined,
              }
            : undefined,
          released: t.released ? signed(t.released, U.gate_manager.name) : undefined,
          delivered: t.delivered ? signed(t.delivered, U.sales_executive.name) : undefined,
        }
      : undefined;

    return {
      id: `seed-${n}`,
      provisionalId: `PRV-2609-${String(n).padStart(4, "0")}`,
      stockId: t.received ? `TW-${String(++stock).padStart(5, "0")}` : undefined,
      createdAt: ago(t.created),
      enteredBy: U.branch_manager.name,
      stage: s.stage,
      stageHistory,
      source: s.source,
      branchId: s.branchId,
      registrationNo: s.registrationNo,
      make: s.make,
      model: s.model,
      variant: s.variant,
      year: s.year,
      engineCc: s.engineCc,
      odometerKm: s.odometerKm,
      colour: s.colour,
      owners: s.owners,
      fuel: s.make === "Ather" ? "electric" : "petrol",
      chassisNo: `ME4${s.make.slice(0, 2).toUpperCase()}${n}8A7L${8000 + n * 17}`,
      engineNo: `EN${70000 + n * 311}`,
      insuranceValidTill: new Date(now + (200 - n * 13) * 24 * HOUR).toISOString().slice(0, 10),
      insurancePolicyNo: `3005/${21000000 + n * 7919}`,
      financeStatus: n % 5 === 0 ? "financed" : "free",
      financier: n % 5 === 0 ? "Muthoot Capital" : undefined,
      nocStatus: n % 5 === 0 ? "received" : undefined,
      conditionNotes: "Good overall. Minor scratches on the side panel.",
      accidentHistory: n === 9 ? "minor" : "none",
      knownDefects: n === 8 ? "Chain set worn, front brake pads low" : "",
      agreedValuePaise: s.value * 100,
      seller: { name: s.seller, phone: `98470${String(10000 + n * 1234).slice(0, 5)}` },
      photos: {},
      verified: t.verified !== undefined ? signed(t.verified, n % 2 ? U.branch_manager.name : U.hub_admin.name) : undefined,
      purchase:
        t.purchase !== undefined
          ? {
              deductionsPaise: (s.deductions ?? 0) * 100,
              deductionNote: s.deductions ? "Pending traffic fines" : "",
              netPayablePaise: net,
              entered: signed(t.purchase, U.branch_accountant.name),
              payout: {
                status: t.paid !== undefined ? "paid" : t.approved !== undefined ? "approved" : "requested",
                approved: t.approved !== undefined ? signed(t.approved, U.central_accountant.name) : undefined,
                paid: t.paid !== undefined ? signed(t.paid, U.central_accountant.name) : undefined,
                reference: t.paid !== undefined ? `NEFT${400100 + n}` : undefined,
              },
            }
          : undefined,
      dispatch: t.dispatched !== undefined ? { rider: ["Shibu", "Arun", "Nikhil"][n % 3], handoverAt: ago(t.dispatched), by: U.branch_manager.name } : undefined,
      receipt: t.received !== undefined ? { ...signed(t.received, U.hub_admin.name), regConfirmed: s.registrationNo, notes: "" } : undefined,
      recon:
        t.received !== undefined
          ? {
              supervisor: s.supervisor ?? SUPERVISORS[0],
              startedAt: ago(t.received),
              items: (s.items ?? [["labour", "General service", 800]]).map(([kind, description, cost], i) => ({ id: `ji-${n}-${i}`, kind, description, costPaise: cost * 100 })),
              photos: [],
              completed: t.reconDone !== undefined ? signed(t.reconDone, s.supervisor ?? SUPERVISORS[0]) : undefined,
              sendBacks: [],
            }
          : undefined,
      gate: t.gate !== undefined ? signed(t.gate, U.gate_manager.name) : undefined,
      proposedPricePaise: s.price ? s.price * 100 : undefined,
      sale: s.customer
        ? {
            status: t.sold !== undefined ? "sold" : "booked",
            customer: { name: s.customer[0], phone: s.customer[1] },
            bookedAt: ago(t.booked ?? t.sold!),
            bookingAmountPaise: (s.booking ?? 5000) * 100,
            soldAt: t.sold !== undefined ? ago(t.sold) : undefined,
            salePricePaise: s.salePrice ? s.salePrice * 100 : undefined,
            by: U.sales_executive.name,
            prevStage: 10,
            docsVerified: s.docsVerified ? signed((t.sold ?? t.booked!) - 2, U.sales_executive.name) : undefined,
          }
        : undefined,
      delivery,
      documents: [],
    };
  };

  const base = { owners: 1, source: "exchange" as const };
  return [
    build(1, { ...base, stage: 1, registrationNo: "KL08BK1402", make: "Bajaj", model: "Pulsar 150", variant: "Twin Disc", year: 2018, engineCc: 149, odometerKm: 42700, colour: "Black", branchId: "b4", value: 46000, seller: "Rahul P", t: { created: 5 } }),
    build(2, { ...base, stage: 3, registrationNo: "KL17L9034", make: "TVS", model: "Jupiter", variant: "ZX", year: 2019, engineCc: 110, odometerKm: 31200, colour: "White", owners: 2, branchId: "b1", source: "direct", value: 38500, seller: "Suresh Nair", t: { created: 36 } }),
    build(3, { ...base, stage: 2, registrationNo: "KL11AV3390", make: "Suzuki", model: "Access 125", variant: "Special Edition", year: 2020, engineCc: 124, odometerKm: 27600, colour: "Grey", branchId: "b2", value: 49000, seller: "Nisha Varghese", t: { created: 77 } }),
    build(4, { ...base, stage: 4, registrationNo: "KL07MM2020", make: "Honda", model: "Shine", variant: "Disc", year: 2021, engineCc: 124, odometerKm: 23400, colour: "Red", branchId: "b1", value: 58000, deductions: 1500, seller: "Arun Kumar", t: { created: 30, verified: 24, purchase: 20 } }),
    build(5, { ...base, stage: 4, registrationNo: "KL44C8812", make: "Hero", model: "Glamour", variant: "Xtec", year: 2022, engineCc: 125, odometerKm: 12800, colour: "Blue", branchId: "b3", source: "direct", value: 61000, seller: "Jaison K", t: { created: 170, verified: 150 } }),
    build(6, { ...base, stage: 6, registrationNo: "KL40B7788", make: "Yamaha", model: "R15 V4", variant: "M", year: 2022, engineCc: 155, odometerKm: 9800, colour: "Blue", branchId: "b3", value: 138000, seller: "Fathima R", t: { created: 60, verified: 50, purchase: 46, approved: 30, dispatched: 20 } }),
    build(7, { ...base, stage: 6, registrationNo: "KL39P4411", make: "Bajaj", model: "Platina", variant: "110", year: 2019, engineCc: 115, odometerKm: 38900, colour: "Black", branchId: "b1", source: "direct", value: 32000, deductions: 800, seller: "Manoj T", t: { created: 100, verified: 90, purchase: 85, dispatched: 60 } }),
    build(8, { ...base, stage: 8, registrationNo: "KL63F2231", make: "Royal Enfield", model: "Classic 350", variant: "Signals", year: 2020, engineCc: 349, odometerKm: 26150, colour: "Green", branchId: "b1", source: "direct", value: 124000, seller: "Jose Mathew", t: { created: 150, verified: 140, purchase: 135, approved: 120, paid: 110, dispatched: 55, received: 30 }, items: [["part", "Chain sprocket kit", 2400], ["part", "Front brake pads", 650], ["labour", "Fitting and service", 1200]], price: 148000 }),
    build(9, { ...base, stage: 8, registrationNo: "KL10AX7001", make: "Yamaha", model: "FZ-S", variant: "V3", year: 2020, engineCc: 149, odometerKm: 29800, colour: "Grey", branchId: "b2", value: 72000, seller: "Deepak S", t: { created: 200, verified: 190, purchase: 185, approved: 170, paid: 160, dispatched: 110, received: 80 }, items: [["vendor", "Tank dent removal and paint", 3500], ["labour", "Service", 900]], price: 86000 }),
    build(10, { ...base, stage: 8, registrationNo: "KL12H3456", make: "TVS", model: "NTorq 125", variant: "Race XP", year: 2021, engineCc: 124, odometerKm: 15600, colour: "Red", branchId: "b5", value: 68000, seller: "Vinod M", supervisor: SUPERVISORS[1], t: { created: 180, verified: 170, purchase: 165, approved: 150, paid: 140, dispatched: 100, received: 56, reconDone: 4 }, items: [["part", "Rear tyre", 1900], ["labour", "Polish and service", 800]], price: 82000 }),
    build(11, { ...base, stage: 10, registrationNo: "KL07CD4521", make: "Honda", model: "Activa 6G", variant: "DLX", year: 2021, engineCc: 110, odometerKm: 18400, colour: "Grey", branchId: "b2", value: 52000, seller: "Anoop K", t: { created: 400, verified: 390, purchase: 385, approved: 370, paid: 360, dispatched: 300, received: 280, reconDone: 150, gate: 100 }, price: 62000 }),
    build(12, { ...base, stage: 10, registrationNo: "KL05Q9090", make: "KTM", model: "Duke 200", variant: "BS6", year: 2021, engineCc: 199, odometerKm: 14200, colour: "Other", branchId: "b4", source: "direct", value: 118000, seller: "Harikrishnan", t: { created: 300, verified: 290, purchase: 285, approved: 270, paid: 260, dispatched: 200, received: 180, reconDone: 60, gate: 40 }, price: 145000 }),
    build(13, { ...base, stage: 11, registrationNo: "KL43G5127", make: "TVS", model: "Apache RTR 160", variant: "4V", year: 2021, engineCc: 160, odometerKm: 17300, colour: "Black", branchId: "b3", source: "direct", value: 88000, seller: "Vishnu S", t: { created: 500, verified: 490, purchase: 485, approved: 470, paid: 460, dispatched: 400, received: 380, reconDone: 300, gate: 280, booked: 24 }, price: 104000, customer: ["Meera Joseph", "9446023456"], booking: 10000 }),
    build(14, { ...base, stage: 11, registrationNo: "KL05AQ6610", make: "Hero", model: "Splendor Plus", variant: "i3S", year: 2021, engineCc: 97, odometerKm: 21900, colour: "Red", branchId: "b5", source: "direct", value: 41000, seller: "Biju Thomas", t: { created: 600, verified: 590, purchase: 585, approved: 570, paid: 560, dispatched: 500, received: 480, reconDone: 400, gate: 380, booked: 96, sold: 48 }, price: 52000, customer: ["Akhil Raj", "9895012345"], booking: 5000, salePrice: 52500, transferDone: 2, fee: "requested", docsVerified: true }),
    build(15, { ...base, stage: 11, registrationNo: "KL01Z7777", make: "Honda", model: "Unicorn", variant: "160", year: 2019, engineCc: 162, odometerKm: 33400, colour: "Silver", branchId: "b1", value: 64000, seller: "George P", t: { created: 700, verified: 690, purchase: 685, approved: 670, paid: 660, dispatched: 600, received: 580, reconDone: 500, gate: 480, booked: 170, sold: 144 }, price: 76000, customer: ["Sreejith V", "9745011223"], booking: 8000, salePrice: 75000, transferDone: 1, docsVerified: true }),
    build(16, { ...base, stage: 11, registrationNo: "KL02K2468", make: "Ather", model: "450X", variant: "Gen 3", year: 2022, engineCc: 6400, odometerKm: 11200, colour: "White", branchId: "b2", source: "direct", value: 96000, seller: "Neethu Mohan", t: { created: 650, verified: 640, purchase: 635, approved: 620, paid: 610, dispatched: 560, received: 540, reconDone: 460, gate: 440, booked: 150, sold: 120 }, price: 112000, customer: ["Ajmal Khan", "9633044556"], booking: 10000, salePrice: 110000, transferDone: 5, fee: "paid", docsVerified: true }),
    build(17, { ...base, stage: 12, registrationNo: "KL14R1357", make: "Suzuki", model: "Access 125", variant: "Ride Connect", year: 2021, engineCc: 124, odometerKm: 16700, colour: "Blue", branchId: "b3", value: 55000, seller: "Priya Das", t: { created: 900, verified: 890, purchase: 885, approved: 870, paid: 860, dispatched: 800, received: 780, reconDone: 700, gate: 680, booked: 380, sold: 336, released: 264, delivered: 240 }, price: 66000, customer: ["Rincy Paul", "9562077889"], booking: 5000, salePrice: 65500, transferDone: 5, fee: "paid", docsVerified: true }),
  ];
}
