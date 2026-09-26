# Trust Wheels Operations Platform
## End-User Manual & System Guide

**For:** every staff member at the five branches and the Angamaly central hub
**Version:** 1.0 (web app, first release) · September 2026

---

## Contents

1. [Getting started (read this first)](#1-getting-started-read-this-first)
2. [How a vehicle moves through the system](#2-how-a-vehicle-moves-through-the-system)
3. [Time limits, alerts and colours](#3-time-limits-alerts-and-colours)
4. Role guides
   1. [Proprietor](#41-proprietor)
   2. [Partner](#42-partner)
   3. [Branch Manager](#43-branch-manager)
   4. [Branch Accountant](#44-branch-accountant)
   5. [Administration (Angamaly)](#45-administration-angamaly)
   6. [Supervisor (Reconditioning, Angamaly)](#46-supervisor-reconditioning-angamaly)
   7. [Manager (Angamaly Gatekeeper)](#47-manager-angamaly-gatekeeper)
   8. [Sales Executive (Angamaly)](#48-sales-executive-angamaly)
   9. [Telecaller](#49-telecaller)
   10. [Central Accountant (Angamaly)](#410-central-accountant-angamaly)
   11. [HR / Admin](#411-hr--admin)
5. [One vehicle, start to finish: who does what](#5-one-vehicle-start-to-finish-who-does-what)
6. [Common problems and what to do](#6-common-problems-and-what-to-do)
7. [Coming in later releases](#7-coming-in-later-releases)
8. [Quick reference: who can open which screen](#8-quick-reference-who-can-open-which-screen)

---

## 1. Getting started (read this first)

### 1.1 Signing in

1. Open the Trust Wheels link on your phone or computer.
2. On the **Welcome back** page, enter your **Email** and **Password**.
3. Tap **Sign in**. You land on **your own Dashboard**: the numbers and lists there are only the work that belongs to you.
4. To sign out, tap **Sign out** at the bottom of the menu.

> **Forgot password?** Tap **Forgot password?** under the password box. Until email reset is switched on, ask your HR / Admin to reset it.

### 1.2 Finding your way around

| Part of the screen | What it does |
|---|---|
| **Menu** (left side on a computer; tap **☰** at the top-left on a phone) | Shows **only the screens your role may use**. If you can't see a screen, your role doesn't need it. |
| **Red / amber number next to a menu item** | Work waiting for attention (for example, 2 overdue vehicles). Red = urgent, amber = soon. |
| **Branch label** (📍 at the top) | The branches whose data you can see, e.g. *All branches* or *Kothamangalam, Perumbavoor*. |
| **⚙️ Settings button** (gear, top bar; also **Settings** at the bottom of the menu) | Opens **Settings**. Everyone can choose **Theme** (Light, Dark, System) and **Colour theme** (Ocean, Aurora, Sunset, Emerald, Gold); these only affect your own device. The Proprietor and HR / Admin also see **Organisation**: Team & roles and Branches. |
| **Sun / moon button** | Quick switch between light and dark mode. Dark mode is easier on the eyes at night. |
| **Your name** (top-right) | Shows who is signed in and your role. |

### 1.3 Words used in this manual

| Word | Meaning |
|---|---|
| **Provisional ID** (e.g. `PRV-2609-0007`) | Issued the moment a branch saves a new vehicle. |
| **Stock ID** (e.g. `TW-01051`) | The permanent number, issued only when Angamaly receives the vehicle. |
| **Verified** | The vehicle's details and documents have been checked and ticked by an authorised person. |
| **Dispatch** | Sending the vehicle from a branch to Angamaly with a rider. |
| **Job card** | The list of repairs (parts, labour, outside work) done during reconditioning, with costs. |
| **Quality gate** | The Angamaly Manager's inspection before a vehicle goes **On display**. |
| **Final release** | The Angamaly Manager's approval that a sold vehicle may be handed to the customer. |
| **Code Red** | A serious delay that is escalated to the Manager and the Proprietor. |
| **RED flag** | A vehicle that has been in reconditioning too long (48 or 72 hours). |
| **Landed cost** | What a vehicle has cost us: purchase + reconditioning + transfer fee. |
| **Ledger** | The permanent record of all money in and out. Entries are never edited, only reversed. |

### 1.4 When the system says "Blocked"

If a button is greyed out with a 🔒 lock, or a red message appears starting with **"Blocked:"**, the system is protecting a business rule. The message always says **why** (for example, *"Blocked: KL 07 ZZ 9999 does not match the dispatch record"*). Fix the reason and try again. Nobody, not even the Proprietor, can skip these rules.

If you open a screen that isn't part of your role, you will see **403 · Forbidden** with the list of roles that do use it. Tap **Go to my dashboard**.

---

## 2. How a vehicle moves through the system

Every vehicle passes through 12 stages. You can see them on any vehicle's page under **Lifecycle**.

| # | Stage | Who moves it forward | Where in the app |
|---|---|---|---|
| 1 | Entered | Branch Manager | **Add stock** |
| 2 | Documents attached | Branch Manager | Vehicle page |
| 3 | Cross-verified | Branch Manager / Administration / Manager | **Mark as verified** |
| 4 | Acquisition recorded | Branch Accountant | **Seller payments → Enter purchase** |
| 5–6 | Dispatched / In transit | Branch Manager | **Transit → Dispatch** |
| 7 | Received at Angamaly | Administration | **Receiving → Receive** |
| 8 | Under reconditioning | Supervisor | **Reconditioning → Open job card** |
| 9–10 | Manager approved / On display | Manager (Angamaly) | **Quality gate → Approve for display** |
| 11 | Sold / Booked | Sales Executive | **Book & sell** |
| 12 | Delivered | Manager releases, Sales hands over | **Deliveries** |

---

## 3. Time limits, alerts and colours

### 3.1 The time limits (SLAs)

| Rule | Limit | What happens when it is missed |
|---|---|---|
| Verify a new vehicle | **48 hours** after it is entered | Red **Not verified · overdue** mark; listed under **Verification → Not verified in time** |
| Transit to Angamaly | **48 hours** after dispatch | Red **Breached · escalated to manager & proprietor** |
| Reconditioning | **48 h** = RED 48h (amber) · **72 h** = RED 72h (red) | Counted against the named supervisor |
| Enquiry follow-up calls | A call on **Day 2, Day 3 and Day 4** | A missed call becomes **Code Red** and is escalated |
| Incoming call (telecaller) | Call back within **30 minutes**; after *No answer / Busy*, redial within **2 hours** | Amber **Call within …** in the last third of the window, red **Late by …** after |
| Delivery after sale | **4 days** from sale | **Code Red** to the Manager and Proprietor |
| Pay the seller | **7 working days** after verification (Sundays and holidays don't count) | Amber **Due soon** in the last 2 working days, red **Overdue** after |

### 3.2 What the colours mean

| You see | Meaning | What to do |
|---|---|---|
| 🟢 Green | Done, verified, on track | Nothing |
| 🔵 Theme colour (blue, violet, etc.) | Normal information or a timer that is still fine | Keep an eye on it |
| 🟡 Amber | Warning: a limit is close | Act today |
| 🔴 Red, **Critical** or **Code Red** | A limit has been missed and managers have been alerted | Act immediately |
| 🔒 Lock icon | A rule is blocking this step | Read the reason shown under it |

Every warning also has **words and an icon**, so you never have to rely on colour alone.

---

## 4. Role guides

Each role guide follows the same five parts:
**A.** Purpose · **B.** Your screens · **C.** Daily workflow · **D.** Rules you must follow · **E.** Checklist & troubleshooting

---

### 4.1 Proprietor

**Mr. Anoop** · All branches and the Angamaly hub

#### A. Purpose
You see the whole business: stock, where every vehicle is, money, people, and every delay. You can do any action in the system (you are the master admin), but your main job is **oversight and unblocking**. HR records are view-only for you. The HR team edits them.

#### B. Your screens
Everything in the menu: **Dashboard, Escalations, Reports**, all **Stock & hub** screens, all **Sales** screens, **Call lists, Campaigns**, all **Finance** screens, and the **People** screens (view only).

#### C. Daily workflow

**Morning (10 minutes)**
1. Open **Dashboard**. Read the four tiles at the top:
   - **Stock on hand** (and its value at landed cost)
   - **On display** (and how many are still in the pipeline)
   - **Sales this month** (revenue and margin)
   - **Critical escalations** (red if anything is Code Red)
2. Scroll to **Escalations**. These are the six most urgent problems. Tap any item to jump straight to the screen where it is fixed.
3. Look at **Vehicle workflow**. It's a table of every branch against every stage. A number stuck in *In transit* or *Reconditioning* is a question to ask.
4. Check **Cash flow, all branches** (money in above the line, money out below) and **Branch performance**.
5. Glance at **HR overview**: headcount, present today, pending leave.

**During the day**
- Open **Escalations** from the menu whenever its red counter goes up. Use the filter chips (**Code Red delivery, Transit breach, Reconditioning RED, Missed follow-up, Seller payment, Verification overdue**) to focus.
- Call the **Owner** named on each escalation (for example *Owner: Angamaly manager · Sales*).

**When staff or branches change**
- **Settings → Team & roles**: tap **Edit name** on any role to change who is shown for it (for example a new Supervisor).
- **Settings → Branches**: tap **Edit name** to rename a branch (for example replace "Branch 3" with the real town name).
- You and HR / Admin can both do this.

**Weekly**
- **Reports**: stock ageing (vehicles unsold for 60+ days), sales and margin by vehicle and by month, and branch performance. Tap **Export CSV** to send any table to the accountant.

#### D. Rules you must follow
- You **cannot** override a hard lock. If a delivery is locked, the ownership transfer really isn't complete. Ask the team to finish it rather than looking for a way round.
- Ledger entries can never be edited or deleted. Corrections are made by the Central Accountant as **reversals**.
- HR changes (attendance, leave, roster) go through the HR / Admin team.

#### E. Checklist & troubleshooting

**Daily checklist**
- [ ] Critical escalations = 0, or each one has an owner working on it
- [ ] No vehicle over 48 h in transit
- [ ] No RED 72h in reconditioning
- [ ] No Code Red deliveries
- [ ] Seller payments: nothing overdue

| Situation | What to do |
|---|---|
| A **Code Red delivery** keeps showing | Open it from **Escalations**. It goes to **Deliveries**, where the lock lists the missing transfer steps. Call the Sales Executive to finish them, then the Manager to release. |
| A vehicle shows **Not received** after 48 h | Call the Branch Manager (rider details are on the **Transit** screen) and Administration at Angamaly. |
| Margin looks wrong | Open the vehicle page → **Workflow** card → **Landed cost**. Check the job card total and transfer fee. |

---

### 4.2 Partner

Kothamangalam & Perumbavoor branches (demo login: Mathew Joseph)

#### A. Purpose
You follow the money and performance of **your branches only**: capital invested, cash flow, transactions, settlements and branch results. Your access is **view only**; you cannot change records.

#### B. Your screens
**Dashboard, Reports, All stock, Book & sell** (view), **Settlements, Ledger, Funds & cash flow**.
Your branch label shows *Kothamangalam, Perumbavoor*. Vehicles, transactions and reports from other branches are hidden from you.

#### C. Daily workflow
1. **Dashboard**. Read your tiles:
   - **Capital invested**
   - **Stock value**
   - **Sales this month**
   - **Margin this month**
   - **Outstanding settlements** (money Angamaly still owes your branches)
2. Below the tiles: **Branch performance** for your two branches and your **recent transactions**.
3. **Funds & cash flow**:
   - **Fund tracking by branch**: capital in, money tied up in stock, and cash position.
   - **Capital contributions**: every amount you put in, with date.
   - **Weekly cash flow** chart. Tap **Table** to see the numbers, or **Export CSV** to download them.
4. **Settlements**: for each of your branches, *Total due (received vehicles)*, *Settled to date* and *Outstanding*.
5. **Ledger**: every rupee in and out for your branches. Use **Type**, **Branch** and **From / To** dates to filter, and **Export CSV** to download.

#### D. Rules you must follow
- You see only Kothamangalam and Perumbavoor. If you need another branch, ask the Proprietor.
- Numbers come straight from the operations. If one looks wrong, report it to the Central Accountant. Don't ask staff to re-enter data.

#### E. Checklist & troubleshooting
- [ ] Weekly: outstanding settlements trending down
- [ ] Weekly: stock ageing, no vehicles unsold for 60+ days
- [ ] Monthly: download the ledger CSV for your records

| Situation | What to do |
|---|---|
| A transaction looks wrong | Note its date and memo and send it to the Central Accountant. They correct it with a reversal, which appears in the ledger as a new line tagged **Reverses**. |
| A vehicle page shows **403 · Outside your scope** | That vehicle belongs to a branch outside your scope. This is expected. |

---

### 4.3 Branch Manager

Your branch(es) (demo login: Jithin Varghese, Kothamangalam & Branch 3)

#### A. Purpose
You bring vehicles into the business: record every exchange or direct purchase, attach and verify the details, and dispatch vehicles to Angamaly **on time**.

#### B. Your screens
**Dashboard, All stock, Add stock, Verification, Transit.**

#### C. Daily workflow

**Step 1: Record a new vehicle (as soon as it arrives at your branch)**
1. Tap **Add stock** in the menu.
2. **Intake**: choose **Branch exchange** or **Direct purchase**, and check the **Branch**.
3. **Vehicle**: type the **Registration no.**
   - It formats itself (e.g. `KL 07 AB 1234`) and turns green when valid.
   - If you see *"This registration is already in the system"*, check the linked record. It may be a genuine re-purchase.
   - Then choose **Make**, **Model**, **Year** and **Fuel**, and enter **Engine CC**, **Odometer (km)**, **Colour**, **No. of owners**, **Chassis no.** and **Engine no.**
4. **Photos**: tap each of the 6 boxes: **Front, Rear, Left side, Right side, Odometer, Chassis vs RC** (the chassis number photographed next to the RC). On a phone the camera opens directly. The counter must show **6/6**.
5. **Insurance & finance**: enter the insurance date and policy number. Choose **Free (no loan)** or **Under finance**; if under finance, enter the **Financier** and the **NOC status**.
6. **Condition**: choose the accident history, and note the condition and any known defects.
7. **Seller & value**: enter the seller's name, 10-digit mobile, and the **Agreed value** in ₹.
8. Tap **Save vehicle**. You get a **Provisional ID**, and the **48-hour verification timer** starts.

> 💡 If the bar at the bottom says *"3 fields need attention"*, scroll up. The fields with problems are outlined in red.

**Step 2: Verify within 48 hours**
1. Check the documents (RC, insurance, NOC, seller ID) against what was entered.
2. Open the vehicle (from **All stock** or **Verification**) and tap **Mark as verified**. Or tick the ☐ box next to the vehicle in any list.
3. **Verification** shows two sections: **Not verified in time** (red, overdue) and **Awaiting verification**, with a live countdown (e.g. *Verify in 11h 58m 03s*).

**Step 3: Dispatch to Angamaly**
1. Open **Transit**. Under **Ready to dispatch** you'll see your verified vehicles.
2. Tap **Dispatch**, enter the **Rider name**, then tap **Hand over now**.
3. The vehicle moves to **In transit** with a live timer. The 48-hour limit starts now.

**Step 4: Watch transit**
- **In transit** shows each vehicle's rider, handover time and hours elapsed. Anything over 48 h turns red.
- **Branch transit performance** shows your branch's average transit time and number of breaches.

#### D. Rules you must follow
- **No dispatch without verification.** Unverified vehicles show *"Can't dispatch until documents are verified"*.
- **Verify within 48 hours** of entering a vehicle, or it goes red and is escalated.
- **Transit must finish within 48 hours.** Choose a rider who can reach Angamaly the same or next day.
- Once dispatched, verification is **locked** and cannot be removed.
- You can only enter and see vehicles for **your own branches**.

#### E. Checklist & troubleshooting

**Daily checklist**
- [ ] Every vehicle that arrived today is entered with 6 photos
- [ ] Nothing in **Verification → Not verified in time**
- [ ] Every verified vehicle is dispatched or scheduled
- [ ] Nothing red on **Transit → In transit**

| Situation | What to do |
|---|---|
| The registration box shows *"That doesn't match an Indian registration"* | Check for a mistyped letter or digit. The format is state, RTO, series, number (e.g. KL 07 AB 1234), or Bharat series 22 BH 1234 AA. |
| A photo won't upload | Retake it. Very large images are shrunk automatically, so the problem is usually a failed camera capture. |
| **Dispatch** button is missing | The vehicle isn't verified yet. Verify it first. |
| A transit is about to breach | Call the rider and Administration at Angamaly. The breach alerts the Manager and Proprietor automatically at 48 h. |
| Angamaly says the plate doesn't match | Check the registration you typed on the vehicle page. Call Administration; they cannot receive the vehicle until it matches. |

---

### 4.4 Branch Accountant

Your branch (demo login: Divya Menon, Kothamangalam)

#### A. Purpose
You record what we paid for each vehicle (purchase value and deductions), raise the seller's payout, and track it against our **7-working-day promise** to the seller. You also track the money Angamaly owes your branch.

#### B. Your screens
**Dashboard, All stock, Seller payments, Settlements.**

#### C. Daily workflow

**Step 1: Morning check**
Open **Dashboard** and read the four tiles:
- **Purchase entries pending**: vehicles verified but not yet entered by you
- **Seller payments due ≤2 working days**
- **Seller payments overdue**
- **Amount due from Angamaly**

**Step 2: Enter the purchase value**
1. Open **Seller payments**. Under **Purchase value entry**, find the vehicle.
2. Tap **Enter purchase**.
3. Check the agreed value. Enter any **Deductions** (e.g. pending traffic fines) and a **Deduction note**. The **Net payable** is worked out for you.
4. Tap **Request payout**. The request goes to the Central Accountant for approval.
5. Made a mistake? While the payout is still *Requested*, tap **Edit entry**.

**Step 3: Track the seller payment**
The **Seller payment tracker** shows, for every vehicle, the due date, working days left and status:
*Awaiting purchase entry → Awaiting approval → Approved, unpaid → Paid*.
- 🟡 **Due in 2 working days**: remind the Central Accountant today.
- 🔴 **Overdue**: the promise to the seller is broken. Escalate at once.

**Step 4: Settlements**
**Settlements** shows *Amount due from Angamaly* for your branch: vehicles Angamaly has received, minus what it has already settled.

#### D. Rules you must follow
- The **7-working-day clock starts at verification**, not when you make the entry. Enter purchases the same day a vehicle is verified.
- Sundays and public holidays are not counted.
- After the Central Accountant approves a payout you **cannot edit it**. Ask them to reverse it if something is wrong.
- Deductions must be less than the agreed value, and always need a note.

#### E. Checklist & troubleshooting

**Daily checklist**
- [ ] *Purchase entries pending* = 0
- [ ] Nothing *Overdue* in the seller payment tracker
- [ ] Anything *Due in ≤2 working days* has been flagged to the Central Accountant

| Situation | What to do |
|---|---|
| A vehicle isn't in **Purchase value entry** | It hasn't been verified yet. Ask the Branch Manager to verify it. |
| **Edit entry** has disappeared | The payout is already approved. Contact the Central Accountant. |
| The seller calls asking for money | Check the tracker. *Approved, unpaid* means payment is on its way; *Paid* shows the UTR reference to share with the seller. |

---

### 4.5 Administration (Angamaly)

Angamaly receiving desk (demo login: Rahul Nair)

#### A. Purpose
You receive every vehicle arriving from the branches, check that it really is the vehicle on the dispatch note, and book it into Angamaly stock (which issues the permanent **Stock ID**).

#### B. Your screens
**Dashboard, All stock, Verification, Transit** (view), **Receiving.**

#### C. Daily workflow

**Step 1: Morning check**
Open **Dashboard** and read the tiles:
- **Arriving**: vehicles on the way
- **Breached transit**: vehicles over 48 h
- **Received today**
- **Awaiting verification**

**Step 2: Receive a vehicle when it arrives**
1. Open **Receiving**. Under **Arriving**, find the vehicle. Its dispatch note shows the branch, rider, handover time and registration number.
2. Walk to the vehicle and read the number plate yourself.
3. Tap **Receive**. In **Registration number on the plate**, type what **you see on the plate**, not what's on screen.
4. Add **Notes** if anything is unusual (damage, missing key, helmet, etc.).
5. Tap **Confirm receipt**.
6. The system shows the new **Stock ID** (e.g. `TW-01051`). Write it on the vehicle tag, then tap **Done**.
7. The vehicle is automatically assigned to the reconditioning **Supervisor**, and the reconditioning clock starts.

**Step 3: Verification help**
You can also verify vehicles (**Verification** screen, or **Mark as verified** on a vehicle page) when branch documents reach Angamaly.

#### D. Rules you must follow
- **Identity check is a hard rule.** If the plate you type doesn't match the dispatch record, receipt is **blocked**. Never "correct" what you type to match the screen.
- Receive vehicles **on arrival**. The transit clock only stops when you confirm receipt.

#### E. Checklist & troubleshooting

**Daily checklist**
- [ ] Every vehicle that arrived today is received with a Stock ID
- [ ] **Breached transit** = 0, or the branch has been called

| Situation | What to do |
|---|---|
| *"Blocked: … does not match the dispatch record"* | Stop. Read the plate again. If it really is different, **do not receive it**. Call the Branch Manager: either the wrong vehicle was sent, or the registration was entered wrongly at the branch. |
| A vehicle arrived but isn't in **Arriving** | The branch hasn't dispatched it in the system. Call the Branch Manager to tap **Dispatch** first. |
| A vehicle is red in **Arriving** | It passed 48 h in transit and has already been escalated. Receive it immediately when it arrives. |

---

### 4.6 Supervisor (Reconditioning, Angamaly)

Angamaly workshop (demo login: Biju Paul)

#### A. Purpose
You recondition vehicles after they are received. You keep a costed **job card**, upload repair photos, and sign off the work. **Your responsibility continues until the Manager approves the vehicle at the quality gate.** Delays count against you by name.

#### B. Your screens
**Dashboard, Reconditioning.** You can also open any vehicle's page from your queue.

#### C. Daily workflow

**Step 1: Morning check**
Open **Dashboard** and read the tiles:
- **In reconditioning**
- **RED 48h** and **RED 72h**
- **Waiting for quality gate**
- **My RED count**

**Step 2: Work the job card**
1. Open **Reconditioning** and look at the **Reconditioning queue**. Each vehicle shows hours since it arrived, and a **RED 48h** / **RED 72h** tag if late.
2. Tap **Open job card**.
3. Add each item of work: choose **Part**, **Labour** or **Vendor** (outside work), type a **Description** and the cost, then tap **Add**. The running total and **landed cost** update as you go.
4. Enter the **Proposed selling price** and save it. The job card shows the margin against landed cost.
5. Tap **Add photos** and upload photos of the finished vehicle, at least **4, one per side**.

**Step 3: Sign off**
1. When all work is done and 4+ photos are uploaded, tap **Sign off work**. Until then the button shows how many photos are still needed (e.g. *1/4 photos*).
2. The vehicle moves to **Waiting for quality gate**, and the job card is locked.

**Step 4: If the Manager sends it back**
The vehicle returns to your queue with the Manager's reason shown. Fix the issue, add photos if needed, and sign off again.

#### D. Rules you must follow
- **48 hours** in reconditioning = **RED 48h**. **72 hours** = **RED 72h**. Both count against **you by name** until the Manager approves.
- **4 photos minimum** (four sides) before sign-off.
- After sign-off you can't change the job card unless the Manager sends it back.
- Enter **real costs**. They feed the vehicle's margin and the accounts.

#### E. Checklist & troubleshooting

**Daily checklist**
- [ ] Every vehicle in the queue has today's work added to its job card
- [ ] Anything close to 48 h is either signed off or you've told the Manager why
- [ ] **My RED count** is going down, not up

| Situation | What to do |
|---|---|
| **Sign off work** is greyed out | You need at least 4 photos. Tap **Add photos**. |
| You can't add an item | The job card is signed off and waiting for the Manager. Ask the Manager to send it back if you must change it. |
| A part is delayed | Add a note to the job card and tell the Manager. The RED clock keeps running. |

---

### 4.7 Manager (Angamaly Gatekeeper)

Angamaly (demo login: Sanjay Pillai)

#### A. Purpose
You are the final check twice:
1. **Quality gate**: no vehicle goes **On display** until you pass it.
2. **Final release**: no sold vehicle is handed to a customer until you release it, and **you cannot release it until the ownership transfer is 100% confirmed.**

You also watch every SLA and Code Red alert across the group.

#### B. Your screens
**Dashboard, Escalations, All stock, Verification, Transit, Reconditioning** (view), **Quality gate, Book & sell** (view), **Deliveries.**

#### C. Daily workflow

**Step 1: Morning check**
Open **Dashboard** and read the tiles:
- **Waiting at quality gate**
- **Awaiting final release** (*x ready · y locked until transfer is confirmed*)
- **Code Red deliveries**
- **Other SLA breaches**

**Step 2: Quality gate**
1. Open **Quality gate** (or use the panel on your dashboard).
2. For each vehicle, check:
   - the photos
   - the job card summary
   - **Landed cost** against the **Proposed price** (and margin)
   - who signed it off, and when
   - that the documents are verified
3. Inspect the vehicle physically.
4. If it's good, tap **Approve for display**. It goes **On display** and can now be sold.
5. If not, tap **Send back**, write **What needs fixing** (required), and tap **Send back**. It returns to the supervisor.

**Step 3: Final release (the hard delivery lock)**
1. Open **Deliveries**. Use the tabs: **Awaiting delivery, Code Red, Ready to release, Released, not handed over, Recently delivered**.
2. Each sold vehicle shows its **Ownership transfer** progress (e.g. *Transfer 3/5*).
3. If everything is complete, the button reads **Release for delivery**. Tap it, and Sales can then hand the vehicle over.
4. If anything is missing, the button reads **🔒 Release locked** and lists exactly what is missing, for example:
   - *Ownership transfer incomplete: New RC issued in buyer's name; Insurance transferred to buyer*
   - *Booking documents not signed off by sales*
   - *Sale not completed (balance not received)*

**Step 4: Monitor alerts**
Keep **Escalations** open. The **SLA & Code Red monitor** on your dashboard shows everything open, most urgent first.

#### D. Rules you must follow
- **No delivery before the RC / name transfer is confirmed.** All 5 steps must be ticked:
  1. Form 29 & 30 signed by seller and buyer
  2. Transfer application submitted at RTO
  3. Transfer fee paid
  4. New RC issued in buyer's name
  5. Insurance transferred to buyer
- The sale must be fully paid, and the booking documents signed off by Sales.
- This lock applies to everyone. There is no override.
- **Code Red** = more than **4 days** since sale without delivery. It is visible to you and the Proprietor.
- A send-back must always have a written reason.

#### E. Checklist & troubleshooting

**Daily checklist**
- [ ] **Waiting at quality gate** cleared, or the supervisor told why
- [ ] Every **Ready to release** vehicle released
- [ ] Every Code Red delivery has an action owner today
- [ ] **Other SLA breaches** reviewed

| Situation | What to do |
|---|---|
| **Release locked**, and the customer is waiting | Read the locked reasons. Call the Sales Executive to complete the missing transfer steps. If *Transfer fee paid* is missing, ask the Central Accountant to approve and pay the RTO fee (paying it ticks that step automatically). |
| A vehicle is **Code Red** but fully transferred | Release it now. Then make sure Sales records the handover the same day. |
| You're unsure about quality | Send it back with a clear reason. Don't approve "for now". Approval puts it on the website and in front of customers. |

---

### 4.8 Sales Executive (Angamaly)

Angamaly showroom (demo login: Aswathy Raj)

#### A. Purpose
You turn enquiries into sales. You capture every enquiry, make the **Day 2, Day 3 and Day 4 calls**, book and sell vehicles, sign off booking documents, complete the ownership-transfer checklist, and hand the vehicle over.

#### B. Your screens
**Dashboard, All stock, Book & sell, Enquiries, Deliveries.**

#### C. Daily workflow

**Step 1: Morning check**
Open **Dashboard** and read the tiles:
- **New enquiries today**
- **Follow-ups due today**
- **Overdue follow-ups** (red)
- **Bookings awaiting doc sign-off**
- **Code Red deliveries**

The **Today's follow-ups** list below the tiles has a **Log call** button on each row.

**Step 2: Capture every enquiry**
1. Open **Enquiries** and tap **New enquiry**.
2. Enter:
   - **Customer name** and **Mobile number**
   - **Source**: Walk-in, Phone, Website, WhatsApp, Facebook or Instagram
   - **Branch**
   - **Vehicle of interest** (or type what they want and their budget)
3. Tap **Save enquiry**. Calls for **Day 2, 3 and 4** are scheduled automatically.

**Step 3: Make the follow-up calls**
1. In **Enquiries** (or on your dashboard), find the row whose call is due and tap **Log day 2**, **Log day 3** or **Log day 4**.
2. Choose the **Outcome**: *Interested, Test ride fixed, Asked to call back, No answer* or *Not interested*.
3. Add a **Note** and tap **Save call**.
4. Tap **Stage** to move the enquiry forward: *New → Contacted → Test ride → Negotiation → Booked*.
5. If they won't buy, choose *Lost* and pick a reason: *Bought elsewhere, Price too high, Finance not approved, Wanted a different model, Postponed purchase* or *Not reachable*.

**Step 4: Book or sell a vehicle**
1. Open **Book & sell**. The **Available** tab lists verified vehicles.
2. Take an advance: tap **Book this vehicle**, enter the customer name, mobile and **Booking amount**, then tap **Confirm booking**.
3. Full sale: tap **Sell this vehicle** (or, on a booked vehicle, **Mark as sold**), enter the **Sale price**, then tap **Confirm sale**. 🎉
4. Customer backed out of a booking? Tap **Cancel booking**. The advance refund is recorded.

**Step 5: Documents and ownership transfer**
1. Open **Deliveries** and find the customer's vehicle.
2. Check the buyer's KYC and booking papers, then tap **Sign off documents**.
3. Work through the **Ownership transfer** checklist, ticking each step as it actually happens:
   - Form 29 & 30 signed
   - Submitted at RTO
   - Transfer fee paid
   - New RC in buyer's name
   - Insurance transferred
4. To get the RTO fee paid, enter the **Transfer fee amount** and tap **Request fee**. The Central Accountant approves and pays it.

**Step 6: Handover**
1. When the Manager has released the vehicle, the button changes from **Handover locked** to **Record handover**.
2. Hand over the keys and papers, then tap **Record handover**. 🎉 The vehicle is **Delivered**.

#### D. Rules you must follow
- **Every enquiry gets three calls: Day 2, Day 3, Day 4.** Day 1 is the day it came in. A missed call becomes **Code Red** and is escalated to the Manager and Proprietor, with your name on it.
- **Deliver within 4 days of the sale.** After that it is **Code Red**.
- **You cannot hand over a vehicle until the Manager releases it**, and the Manager cannot release it until all 5 transfer steps are ticked, the documents are signed off, and the sale is fully paid.
- Only tick a transfer step when it has **really happened**. Every tick is recorded with your name and time.
- You can't log a call before its day opens, or log the same day twice.

#### E. Checklist & troubleshooting

**Daily checklist**
- [ ] Every walk-in and phone enquiry entered
- [ ] **Follow-ups due today** = all logged
- [ ] **Overdue follow-ups** = 0
- [ ] **Bookings awaiting doc sign-off** = 0
- [ ] No sold vehicle waiting on a transfer step you can move today

| Situation | What to do |
|---|---|
| An enquiry shows red **Code Red · Day 3 call missed** | Call the customer now and log it with an honest outcome. Tell your manager why it was missed. |
| **Handover locked** | Read the reason. Usually the vehicle is waiting for the Manager's release, or a transfer step is missing. Finish the step, then ask the Manager to release. |
| Customer wants the vehicle today, but the RC isn't transferred | Explain politely that we cannot legally hand it over until the RC is in their name. Give a realistic date. |
| **Book this vehicle** is missing | The vehicle isn't verified, or it is already booked or sold. |

---

### 4.9 Telecaller

(demo login: Fathima Beevi)

#### A. Purpose
You call customers from organised lists (new enquiries, cold leads, past customers, service due and campaigns), record what happened on every call, and schedule callbacks. The system **records** calls; it does not dial for you.

#### B. Your screens
**Dashboard, Call lists, Campaigns.** The **+ New Incoming Call** button is on your Dashboard and on Call lists.

#### C. Daily workflow

**Step 1: Morning check**
Open **Dashboard** and read the tiles:
- **Calls due today** (including calls carried over from earlier)
- **Overdue callbacks** (red: customers waiting for our call)
- **Calls made today**
- **Interested today**

**Step 2: Log an incoming call (the moment the phone rings)**
1. Tap **+ New Incoming Call** (top-right of **Call lists** and your **Dashboard**).
2. Enter:
   - **Customer name** and **Phone number** (10 digits). If the number is already in the list, you'll see a warning; you can still save a genuinely new enquiry.
   - **Enquiry vehicle / model**: pick from the suggestions or type anything, e.g. *Any scooter under ₹50k*
   - **Call type / source**: Inbound call, WhatsApp, Walk-in enquiry or Website
   - **Initial notes / requirement**: budget, variant, colour, exchange vehicle, finance
3. Choose the **Initial call status**:
   - **New / Needs callback** (default): tap **Add to call list**. It goes to the top of **Incoming calls & new enquiries** with a 30-minute callback timer.
   - **Connected & discussed**: the outcome form opens straight away. Pick *Interested*, *Follow-up (call back later)* with a time, *Not interested* or *Purchased elsewhere*, add notes, and tap **Save call**.
4. If the customer is **Interested**, keep **Send to the sales pipeline now** ticked, pick the **Branch** and **Sales executive**, and save. An enquiry is created for them with Day 2/3/4 follow-ups.

**Working the incoming list**
- Each row shows the customer, vehicle of interest, source and time received, and the **Current status**:
  - 🟡 **Not called yet**
  - 🔵 **Follow-up** with date and time
  - 🟢 **Connected · interested** (or *Interested · with [sales executive]* once sent)
  - ⚪ **No answer / Busy · N attempts**
  - 🔴 **Not interested / Closed**
- **Call / Update status** opens the customer card to record the outcome. The **Update status…** drop-down under the badge opens the same card with that outcome already picked.
- **Edit lead** fixes a typo in the name, phone, vehicle, source or notes.
- **Send to sales** appears on interested callers not yet handed over.
- Amber rows = the callback target is close; red rows = late. Most urgent rows are always at the top.
- A number that already has an open sales enquiry can't be sent again: *"Blocked: … is already in the sales pipeline"*. Nothing is saved; untick **Send to sales** or ask the sales executive.

**Filtering by status**
- The **Status** chips above the lists (*All, Not called yet, Follow-up scheduled, No answer / Busy, Interested, Not interested / Closed*) show a count for each status and filter the incoming calls and every call list at once.
- Every list has a **Current status** column: the status badge, when the call is due (or how late), and an **Update status…** picker.

**Step 3: Work today's list**
1. Open **Call lists**. **Calls due today** lists everything due, with overdue callbacks highlighted in red at the top. Use the tabs to switch lists: *New enquiries, Cold leads, Past customers, Service due, Campaign*.
2. Tap **Log call** on a customer. Their card opens with the **full history of previous calls**. Read it before you dial.
3. Tap the phone number to call (on a phone).
4. After the call, choose the **Call outcome**:

   | Outcome | What happens |
   |---|---|
   | **Interested** | Handed to sales; task closed |
   | **Call back later** | Set **Call back at** (use **In 1 hour** or **Tomorrow 10 am**, or pick a time) |
   | **No answer** | Retried tomorrow |
   | **Not interested** | Task closed |
   | **Purchased elsewhere** | Task closed |
   | **Wrong number** | Task closed |

5. Add a **Note** and tap **Save call**.
6. If the customer asks never to be called again, tap the **do-not-call** option on their card.

**Step 4: Campaigns**
1. Open **Campaigns** to see each campaign's offer and progress (called vs target, interested, conversions).
2. Tap **New campaign**. Enter the **Name**, **Offer**, **Model (optional)**, **Starts**, **Ends**, **Assigned to** and **Call target**, then tap **Create campaign**.
3. Tap **Add customers** to add people to a campaign's call list.

**Step 5: Your performance**
**Today's performance** on **Call lists** shows calls made, connected, interested, and results per person.

#### D. Rules you must follow
- **Call back at the time you promised.** Missed callbacks turn red.
- **A callback always needs a date and time.** The system won't save it without one.
- Never call anyone on the **do-not-call** list. Customers who have already bought are removed automatically.
- Record every call, including *No answer*. Your performance figures come only from what you log.

#### E. Checklist & troubleshooting
- [ ] **Overdue callbacks** = 0 by lunch
- [ ] Every call in **Calls due today** logged by the end of the day
- [ ] Interested customers passed to sales (logging *Interested* does this)

| Situation | What to do |
|---|---|
| *Callback needs a date and time* | Pick **In 1 hour** or **Tomorrow 10 am**, or choose a time. |
| The customer has already bought from us | Log **Purchased elsewhere** or **Not interested** as appropriate. Buyers are removed from future lists automatically. |
| The same customer appears twice | Log the call on one and tell your manager so the duplicate can be merged. |

---

### 4.10 Central Accountant (Angamaly)

Angamaly accounts (demo login: Lakshmi Iyer)

#### A. Purpose
You control money going out: you approve and pay seller payouts, pay RTO/transfer fees, settle what Angamaly owes each branch, and keep the **master ledger** correct.

#### B. Your screens
**Dashboard, All stock, Seller payments, RTO & transfer fees, Settlements, Ledger.**

#### C. Daily workflow

**Step 1: Morning check**
Open **Dashboard** and read the tiles:
- **Payouts awaiting approval**
- **Approved, unpaid**
- **RTO fees pending**
- **Settlements outstanding**
- **Today's net cash**

**Step 2: Seller payouts**
1. Open **Seller payments** and go to the **Payout approval queue**.
2. Check the net payable and deduction note, then tap **Approve**.
3. After making the bank transfer, tap **Mark paid**, enter the **UTR / reference**, and tap **Confirm payment**. The payment is posted to the ledger automatically.
4. Pay anything marked **Due in ≤2 working days** or **Overdue** first.

**Step 3: RTO & transfer fees**
1. Open **RTO & transfer fees**. The tabs are **Awaiting approval, Approved, unpaid** and **Paid**.
2. Tap **Approve** on a request from Sales.
3. After paying the RTO, tap **Mark paid**. This posts to the ledger and **automatically ticks "Transfer fee paid"** on the vehicle's ownership-transfer checklist.

**Step 4: Branch settlements**
1. Open **Settlements**. For each branch you'll see *Total due (received vehicles)*, *Settled to date* and *Outstanding*.
2. Tap **Settle** on a branch, enter the **Amount**, **UTR / reference** and **Note**, and tap **Record & post**. Two ledger lines are posted: money out of Angamaly, and money into the branch.

**Step 5: Ledger**
1. Open **Ledger**. Filter by **Type**, **Branch** and **From / To** dates. **Money in**, **Money out** and **Net** update as you filter.
2. To correct a mistake, tap **Reverse** on the entry, write the **Reason**, and tap **Post reversal**. A new opposite entry is added; the original stays, struck through and tagged **Reversed**.
3. Tap **Export CSV** for month-end work.

#### D. Rules you must follow
- **The ledger can never be edited or deleted.** Only reversals, always with a reason.
- An entry can be reversed **once**, and a reversal can't itself be reversed.
- A payout must be **approved before it is paid**, and paid only with a reference.
- A fee must be **approved before it is paid**.
- Seller promise: **7 working days from verification**. Anything overdue damages our reputation with sellers.

#### E. Checklist & troubleshooting

**Daily checklist**
- [ ] **Payouts awaiting approval** = 0
- [ ] **Approved, unpaid**: all paid, or scheduled for today
- [ ] **RTO fees pending** = 0 (a pending fee blocks deliveries)
- [ ] No seller payment **Overdue**

| Situation | What to do |
|---|---|
| A payout was approved with the wrong amount | Ask the Branch Accountant for the correct figure. If it's already paid, reverse the ledger entry with the reason and record the correct payment. |
| Sales says a delivery is blocked on the fee | Open **RTO & transfer fees**, then **Approve** and **Mark paid**. The checklist step ticks itself. |
| A settlement was recorded twice | **Reverse** one of its ledger lines. Both lines of that settlement are reversed together, and the branch's outstanding amount goes back up. |

---

### 4.11 HR / Admin

All branches and the Angamaly hub (demo login: Reshma George)

#### A. Purpose
You look after people records: the employee master, daily attendance, leave, shift rosters, and the monthly **payroll input sheet** for the accountant. Salary processing and statutory filings are **not** part of this system.

#### B. Your screens
**Dashboard, Employees, Attendance, Leave requests, Shift roster, Payroll input**, and under **Settings**: **Team & roles, Branches**.

#### C. Daily workflow

**Step 1: Morning check**
Open **Dashboard** and read the tiles:
- **Headcount**
- **Present today**
- **On leave today**
- **Pending leave requests** (amber)
- **Late today**

Below the tiles are the pending leave requests (with **Approve** / **Reject**) and **Today's absentees**.

**Step 2: Attendance**
1. Open **Attendance**. It opens on today's date; use the **‹ ›** arrows or **Date** to change day.
2. For each employee, tap their row to **Mark attendance**:
   - **Status**: Present, Absent, On leave, Half day or Week off
   - **Check-in** and **Check-out** times (**Check-in now** / **Check-out now** fill in the current time)
3. Tap **Save**. A check-in after **09:30** is marked **Late**.

**Step 3: Leave requests**
1. Open **Leave requests**.
2. Tap **Approve** or **Reject**. A rejection must have a note.
3. Approving automatically marks those days as leave on attendance (Sundays and holidays are skipped).

**Step 4: Shift roster**
1. Open **Shift roster**, which shows the week grid per branch. Use **‹ ›** to change week.
2. Tap a shift to change it:

   | Shift | Hours |
   |---|---|
   | Morning | 07:00–15:00 |
   | General | 09:30–18:30 |
   | Evening | 12:00–20:00 |
   | Off | — |

3. For a new week, tap **Start roster**. It copies the previous week as a starting point.

**Step 5: Employees**
1. Open **Employees**. Search by name, or filter by branch.
2. Tap an employee to see their details. Tap **Edit** to update them.
3. For a new joiner, tap **Add employee** and enter:
   - **Full name**, **Job title**, **Branch**, **Reports to**
   - **Mobile**, **WhatsApp**, **Email**
   - **Joining date**, **Status**, **Salary band**
4. Tap **Save changes**.

**Changing the name for a role** (e.g. a new Supervisor, a spelling correction)
1. Tap the **⚙️ Settings** button, then **Team & roles**. It shows one card per role, e.g. *Supervisor (Reconditioning): Biju Paul*.
2. Tap **Edit name** on the card, type the new name, and tap **Save** (or press Enter). Tap **Cancel** or press Esc to back out.
3. The new name appears **everywhere**: the sign-in list, the top-right name, dashboard greetings, staff pick-lists, and every new action that person records. The employee record in **Employees** is updated too.
4. Past records (who verified a vehicle last month, who approved a payout) keep the name used at the time, so the history stays accurate.

> 💡 Shortcut: tap your name at the top-right and choose **Edit names for each role**. Names can also be changed from **Employees → Edit → Full name**.

**Renaming a branch** (e.g. replacing the placeholder "Branch 3" with the real town name)
1. Tap the **⚙️ Settings** button, then **Branches**. Each card shows the branch code (B1–B5, ANG), its vehicles and staff, and which limited-scope roles use it.
2. Tap **Edit name**, type the new name, and tap **Save**.
3. The new name shows everywhere at once: the menu's branch label, filters, the Add stock form, vehicle lists, reports, the ledger and HR. All records stay linked, because the branch code never changes.
4. Two branches can't share a name. To undo, tap **Restore** on the card (it shows *Originally …*).

**Step 6: Month end (payroll input)**
1. Open **Payroll input** and choose the **Month**.
2. Check the sheet: working days, present, half days, absent, leave by type, late marks, and sales incentives.
3. Tap **Export CSV** and send the file to the accountant.

#### D. Rules you must follow
- Employee personal data is **confidential**. Don't share screenshots or exports outside HR and accounts.
- A check-in after **09:30** is a late mark.
- Sales incentive (current rule): **₹500 per vehicle sold** in the month, for sales staff.
- Only HR can change attendance, leave and rosters. The Proprietor sees them read-only.

#### E. Checklist & troubleshooting

**Daily checklist**
- [ ] Attendance marked for every branch
- [ ] Pending leave decided within 1 working day
- [ ] Next week's roster started by Saturday

**Month end**
- [ ] All attendance for the month complete
- [ ] Payroll input CSV exported and sent

| Situation | What to do |
|---|---|
| An employee is shown absent but was on approved leave | Check **Leave requests**. If it's approved, the days should show *On leave*. If not, re-open the day in **Attendance** and set **On leave**. |
| A new week's roster is empty | Tap **Start roster** to copy last week, then adjust. |
| Payroll incentive looks wrong | Incentives come from vehicles recorded as sold by that salesperson. Check the sales in **Reports** with the Proprietor. |
| A staff member's name is spelt wrong in the app | **Team & roles → Edit name → Save** (or **Employees → Edit → Full name**). It updates everywhere at once. |
| Someone new has taken over a role (e.g. a new Supervisor) | **Team & roles → Edit name** on that role, then update their mobile and joining date in **Employees**. Assigning a system role to a brand-new employee record isn't available yet. |

---

## 5. One vehicle, start to finish: who does what

**Example:** a Honda Shine comes in as an exchange at Kothamangalam on Monday morning.

| When | Who | Action | Screen / button |
|---|---|---|---|
| Mon 10:00 | Branch Manager | Enters the vehicle with 6 photos, gets `PRV-2609-0012` | **Add stock → Save vehicle** |
| Mon 15:00 | Branch Manager | Checks the RC, insurance and seller ID, then verifies | **Mark as verified** (48 h limit met) |
| Mon 16:00 | Branch Accountant | Enters ₹1,500 fine deduction, raises the payout | **Seller payments → Enter purchase → Request payout** |
| Tue 09:30 | Branch Manager | Rider Shibu takes it to Angamaly | **Transit → Dispatch → Hand over now** |
| Tue 11:00 | Central Accountant | Approves and pays the seller (UTR entered) | **Approve → Mark paid → Confirm payment** |
| Tue 17:00 | Administration | Reads the plate, types it, gets Stock ID `TW-01052` | **Receiving → Receive → Confirm receipt** |
| Wed | Supervisor | Chain kit ₹2,400 + labour ₹1,200, 4 photos, price ₹68,000 | **Open job card → Add → Add photos → Sign off work** |
| Thu 10:00 | Manager | Inspects and approves (recon done in 41 h, no RED) | **Quality gate → Approve for display** |
| Fri | Sales Executive | Walk-in customer books with ₹5,000 advance | **Book & sell → Book this vehicle** |
| Sat | Sales Executive | Balance received; sale recorded | **Mark as sold → Confirm sale** |
| Sat | Sales Executive | Signs off documents; forms signed; fee requested | **Deliveries → Sign off documents / tick steps / Request fee** |
| Mon | Central Accountant | Pays the RTO fee (the step ticks itself) | **RTO & transfer fees → Approve → Mark paid** |
| Tue | Sales Executive | New RC and insurance done; ticks the last steps | **Deliveries** checklist (5/5) |
| Tue 11:00 | Manager | Releases the vehicle (all green) | **Release for delivery** |
| Tue 12:00 | Sales Executive | Hands over keys and papers | **Record handover** (delivered 3 days after sale, no Code Red) |

If the RC hadn't arrived by Wednesday (more than 4 days after the sale), the vehicle would have turned **Code Red** on the Manager's and Proprietor's screens, and the release would have stayed **locked** until the RC step was ticked.

---

## 6. Common problems and what to do

| Problem | Most likely reason | What to do |
|---|---|---|
| I can't see a screen my colleague uses | Your role doesn't include it | This is by design. Ask your manager if you need access. |
| **403 · Forbidden** | You opened a link for another role | Tap **Go to my dashboard**. |
| **403 · Outside your scope** | The vehicle belongs to a branch you don't cover | Ask someone at that branch. |
| A button is missing | Your role can only view this screen | Ask the person responsible (see Section 8). |
| A button shows a 🔒 lock | A business rule isn't met yet | Read the reasons under the button and finish those steps first. |
| A red **"Blocked: …"** message | The system refused the action to protect a rule | Read the message; it names exactly what is wrong. |
| A red number next to a menu item | Something in that screen is late | Open it and act on the red items first. |
| The screen looks too bright or dark | Theme setting | Tap the **sun / moon** button, or **⚙️ Settings → Theme**. |
| Numbers don't update | The page has been open a long time | Refresh the page. |

**Escalation contacts:** first your own manager. For Code Red, the **Angamaly Manager** and the **Proprietor (Mr. Anoop)** are alerted automatically.

---

## 7. Coming in later releases

The following parts of the plan are **not in this first release**. Until they arrive, follow the manual process your manager gives you.

| Feature | What to do for now |
|---|---|
| Uploading document scans (RC, insurance, NOC, Forms 28/29/30) to a document vault | Check the originals; use **Mark as verified** to record the check |
| Re-photographing the vehicle at Angamaly receipt | Note any damage in **Notes** when receiving |
| Customer delivery OTP by SMS | Get the customer's signature on the delivery note |
| WhatsApp staff commands, customer bot, Facebook/Instagram messages | Continue using phone and WhatsApp as today; enter the enquiry in **Enquiries** |
| Warranty claims and service booking | Record on paper; the module comes in the next phase |
| Admin screen to change time limits and other masters (makes/models, holidays) | Ask the Proprietor; limits are currently fixed at the values in Section 3. Branch names and staff names **can** already be changed under **Settings**. |

---

## 8. Quick reference: who can open which screen

✓ = can open · — = no access (403) · *view* = can see but not act

| Screen | Proprietor | Partner | Branch Mgr | Branch Acct | Admin (Ang.) | Supervisor | Manager (Ang.) | Sales Exec | Telecaller | Central Acct | HR |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Escalations | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| Reports | ✓ | ✓ | — | — | — | — | — | — | — | — | — |
| All stock | ✓ | *view* | ✓ | *view* | ✓ | — | ✓ | ✓ | — | *view* | — |
| Add stock | ✓ | — | ✓ | — | — | — | — | — | — | — | — |
| Verification | ✓ | — | ✓ | — | ✓ | — | ✓ | — | — | — | — |
| Transit | ✓ | — | ✓ | — | *view* | — | *view* | — | — | — | — |
| Receiving | ✓ | — | — | — | ✓ | — | — | — | — | — | — |
| Reconditioning | ✓ | — | — | — | — | ✓ | *view* | — | — | — | — |
| Quality gate | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| Book & sell | ✓ | *view* | — | — | — | — | *view* | ✓ | — | — | — |
| Enquiries | ✓ | — | — | — | — | — | — | ✓ | — | — | — |
| Deliveries | ✓ | — | — | — | — | — | ✓ (release) | ✓ (handover) | — | — | — |
| Call lists / Campaigns | ✓ | — | — | — | — | — | — | — | ✓ | — | — |
| Seller payments | ✓ | — | — | ✓ (entry) | — | — | — | — | — | ✓ (approve/pay) | — |
| RTO & transfer fees | ✓ | — | — | — | — | — | — | — | — | ✓ | — |
| Settlements | ✓ | *view* | — | *view* | — | — | — | — | — | ✓ | — |
| Ledger | ✓ | *view* | — | — | — | — | — | — | — | ✓ | — |
| Funds & cash flow | ✓ | *view* | — | — | — | — | — | — | — | — | — |
| Employees, Attendance, Leave, Roster, Payroll | *view* | — | — | — | — | — | — | — | — | — | ✓ |
| Settings: Team & roles, Branches | ✓ | — | — | — | — | — | — | — | — | — | ✓ |

*Branch-scoped roles see only their own branches: Partner (Kothamangalam, Perumbavoor), Branch Manager (their branches), Branch Accountant (their branch). Everyone else sees all branches.*

---

*Trust Wheels Operations Platform · built by Intellijohn Labs. For access changes, contact the Proprietor or HR / Admin.*
