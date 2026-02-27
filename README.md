# 🚀 Peer Learning Group System

A smart web application that forms **balanced study groups** based on students' strengths and weaknesses, enabling effective peer-to-peer learning.

---

## 🧠 Problem Statement

Students often struggle to find the right study partners. Most groups are either:

* Unbalanced (everyone weak or everyone strong)
* Random (no real learning benefit)

This leads to inefficient collaboration and poor learning outcomes.

---

## 💡 Solution

Our system intelligently forms **complementary study groups** by analyzing each student's subject strengths and weaknesses.

Instead of grouping similar students, we:

> Match students so they can **learn from each other**

---

## ✨ Key Features

### 👤 User Profile

* Basic details: Name, Course, Year
* Optional goals for personalized learning

---

### 📊 Subject Skill Tracker

* Students rate themselves (1–10) in subjects:

  * Math (MAC, ODEVC)
  * Coding (PPS, Python)
  * DSA
  * Circuits (BEEE, EDC, Network Analysis, Sensors)
  * Physics & Mechanics
  * Misc (Chem, Cybersecurity, IoT, etc.)

* Skill Levels:

  * 7–10 → Strong 💪
  * 4–6 → Medium ⚖️
  * 0–3 → Weak ⚠️

---

### 🤖 Smart Group Recommendations

* Forms groups of 3–4 students
* Uses **complementary matching logic**

#### Matching Formula:

```
Score = Σ |A_subject - B_subject|
```

* Higher score → Better complementarity

---

### 🔗 Multiple Ways to Join Groups

#### 1. Smart Recommendations

* AI-inspired grouping based on skills

#### 2. Referral Join

* Join via invite code/link

#### 3. ⚡ Quick Join

* Instantly join available compatible groups

---

### 📌 Explainable Matching (Unique Feature)

Each recommendation shows:

* Why you were matched
* Who you can learn from
* Who you can help

---

### 👥 Group Dashboard

* Member list
* Skill comparison (bar graphs)
* Auto-assigned roles (e.g., DSA Expert)

---

### 📊 Group Insights

* Group strengths & weaknesses
* Suggested focus areas

Example:

> “Focus on DSA (weak for 2 members)”

---

### 📝 Task Management

* Shared task checklist
* Track progress per member

---

### 💬 Group Chat

* Simple communication between members

---

## 🏗️ Tech Stack

* **Frontend:** React.js
* **Backend:** Node.js (Express)
* **Database:** SQLite / JSON
* **Visualization:** Charts (Recharts)

---

## 🚀 How It Works

1. User signs up and enters profile details
2. Adds subject scores
3. System analyzes strengths & weaknesses
4. Recommends balanced groups
5. User joins a group
6. Dashboard provides insights, tasks, and collaboration tools

---

## 🎯 Unique Selling Points

* 🔥 Complementary (not similar) matching
* 🧠 Explainable recommendations
* ⚡ Multiple ways to join groups
* 📊 Insight-driven group learning
* 🎓 Focus on real educational impact

---

## 📸 Demo Flow

1. Login → Add skills
2. View recommendations
3. Join group
4. Explore dashboard
5. Track tasks & progress

---

## 🧠 Future Improvements

* Real-time chat
* AI-based study plan generation
* Performance tracking over time
* Integration with learning platforms

---

## 👨‍💻 Team

* Built during a 24-hour hackathon ⚡

---

## 📌 Conclusion

This project transforms random study groups into **structured, intelligent learning ecosystems**, helping students grow together efficiently.

---

