# Maestro

Welcome to **Maestro**! If you use AI agents (like Cursor, Claude, or Gemini) to write code and want them to be *smarter* and *faster*, you are in the right place.

Maestro is like a, well... maestro for your AI's instructions' orchestra. Instead of confusing your AI with rules for *every* programming language at once, Maestro looks at what you want to do and gives the AI **only the rules it needs right now**. 
Maestro is like a, well... maestro for your AI's instructions' orchestra. Instead of confusing your AI with rules for *every* programming language at once, Maestro looks at what you want to do and gives the AI **only the rules it needs right now**. 

This saves tokens (which saves money and memory) and keeps the AI focused.

---

## How it Works (The Folder Structure)

For Maestro to work, you need a main folder where you keep all your "Skill Bundles". A Skill Bundle is just a folder containing a group of skills for a specific topic, like Angular or Python. The bundles can have the name you want to give them, the main folder name is also up to you.

So let's say you are building a landing page, you can have folders in you main folder such as "Front-end-dev", "Tailwind-expert" and "Angular-pro", in which each of these folders have skills related to what says in their names, Maestro will look at your prompt and decide which bundles he will use to help you build your landing page.

Here is how your **skill-bundles-folder** needs to be organized:

```text
?? My-Skill-Bundles/            <-- "skill-bundle-folder"
¦
+-- ?? Angular-pro/             <-- A "Skill Bundle"
¦   +-- ?? Angular-guidelines   <-- Skill folder
¦   ¦   +-- ?? SKILL.md         <-- Skill
¦   +-- ?? [ANOTHER SKILL]
¦   ...
¦
+-- ?? Back-end-expert/         <-- Another "Skill Bundle"
¦
+-- ?? Python-god/              <-- Another "Skill Bundle"
... +-- ?? Python-best-practices
    +-- ?? Python-lib-master    <-- Skill folder
    ...
```
---


## ?? Maestro guide

### Step 1: Installation
1. Place the `Maestro` project inside your current project **OR** set it globally in your AI environment.
2. Make sure you have a folder set up somewhere on your computer that looks like the `My-Skill-Bundles/` example above.

### Step 2: Tell Maestro Where Your Skills Are
The first time you use Maestro, you need to tell it where your skills folder is.
1. Open your AI chat.
2. Type: `/maestro-set <path-to-your-skill-bundle-folder>`
   *Example: `/maestro-set C:\Users\Alisson\My-Skill-Bundles`*
3. Maestro will scan that folder and memorize all the skills you have.

### Step 3: Ask the AI to Do Work!
Now, just start your prompts with `/maestro`. 
1. Open your AI chat.
2. Type: `/maestro Please create a new login page in Angular.`
3. Maestro will see the word "Angular", go to your `Angular-pro` folder, read *only* those rules, and then write the code!

---


> If your agent only shows `/maestro`, use `/maestro switch <folder-path>`, `/maestro fetch`, or `/maestro stats`. These are aliases for `/maestro-set`, `/maestro-fetch`, and `/maestro-stats`.
## The Commands Cheat Sheet

Here are the commands you can type to your AI to control Maestro:

- **`/maestro <your task>`**: This is the main command. Use it whenever you want the AI to do a task using your skills.
- **`/maestro-set <folder-path>`**: Use this if you move your skills folder to a new location, or want to switch to a different skills folder.
- **`/maestro-fetch`**: Use this if you add a new skill bundle, or a skill inside an already existing bundle, or even if you delete a bundle/skill and want Maestro to update its index to know about it.
- **`/maestro-stats`**: Use this to see which folder Maestro is currently using, and a list of all the skills it knows about.

