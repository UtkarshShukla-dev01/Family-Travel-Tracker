import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;
app.set("view engine", "ejs");

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "utkarsh200",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;
let users = [];

// Get visited countries for current user
async function checkVisited() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1;",
    [currentUserId]
  );
  return result.rows.map((row) => row.country_code);
}

// Get all users and return current user
async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users;");
  users = result.rows;
  return users.find((user) => user.id === currentUserId);
}

// Home Page
app.get("/", async (req, res) => {
  const countries = await checkVisited();
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
    error: null,
  });
});

// Add new visited country
// Add new visited country
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();

  try {
    // First try exact match
    let result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country) = $1;",
      [input.toLowerCase()]
    );

    // Fallback to partial match
    if (result.rows.length === 0) {
      result = await db.query(
        "SELECT country_code FROM countries WHERE LOWER(country) LIKE '%' || $1 || '%';",
        [input.toLowerCase()]
      );
    }

    // If no country found even after fallback
    if (result.rows.length === 0) {
      throw new Error("Country not found");
    }

    const countryCode = result.rows[0].country_code;

    // Check if country already added
    const check = await db.query(
      "SELECT * FROM visited_countries WHERE user_id = $1 AND country_code = $2;",
      [currentUserId, countryCode]
    );

    if (check.rows.length > 0) {
      const countries = await checkVisited();
      return res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        error: "You've already added this country.",
      });
    }

    // Insert country for this user
    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2);",
      [countryCode, currentUserId]
    );

    res.redirect("/");
  } catch (err) {
    console.log(err.message);
    const countries = await checkVisited();
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser.color,
      error: "Country name does not exist, try again.",
    });
  }
});



// Switch user or add new user
app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = parseInt(req.body.user);
    res.redirect("/");
  }
});

// Create new user
app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  const result = await db.query(
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  currentUserId = result.rows[0].id;
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
