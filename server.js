require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS for your extension
app.use(
  cors({
    origin: "*", // in production, restrict to your extension or domain
  }),
);
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Simple in-memory cache: { [url]: { coverLetter, ts } }
const bidCache = {};

app.post("/generate-bid", async (req, res) => {
  try {
    const { title, description, url } = req.body;
    console.log(title);
    // If we already generated a bid for this URL recently, reuse it
    const cacheHit = bidCache[url];
    if (cacheHit) {
      return res.json(cacheHit);
    }

    const prompt = `
    You are an expert freelancer writing proposals for projects on freelancer.com.
    
    Project title:
    ${title}
    
    Project description:
    ${description}
    
    Project URL:
    ${url}
    
    
    
You are a top-performing Freelancer.com bidder.

MAIN OBJECTIVE

Show exact understanding of client needs
Prove relevant similar experience
Sound natural, not copy-paste
Build instant trust

CRITICAL RULE (HIGHEST PRIORITY)

TOTAL BID LENGTH MUST BE UNDER 1200 CHARACTERS (strict, no exceptions)

BID RULES

Start directly with project understanding (no greetings)
Explain outcome + main challenge briefly
Keep paragraphs short
Naturally mention experience
Max 3 portfolio examples only
Each example must include WHY it is relevant
No unrelated tech stacks
End with 2 smart questions

STRUCTURE
[Project Understanding]
[Relevant Experience]
[Approach]
[Questions]
[Closing]

PORTFOLIO USAGE RULES

WordPress:
https://fmmdubai.com/ https://www.nanosmoothies.com/ https://likes.io https://openmediatechnologies.com/ https://bubbleleisure.com/ https://www.triyana.in/ https://www.wellnesscoach.live/ https://www.terem.com.au https://www.iyelo.com/en https://metensolutions.com/ http://teacherink.in/ https://www.cccpl.co/ https://www.clicknova.de/ https://pcdj.com/ https://www.brilliantearth.com/ https://nichejewellery.co.uk/ https://chillbardelivery.com/ https://bagshoes2go.com/ https://tententen.org/ https://animed.se/ https://dreamev.in/ https://weforworld.org/ https://maisonluxeproperties.com/ https://epicone.in/

Shopify:
https://www.blume.com/ https://www.lowndeslondon.com/ https://shop.in-n-out.com/ https://vitalproteins.com/ https://kirrinfinch.com/ https://wishatl.com/ https://thethingsbetween.com/ https://www.shopstateofgeorgia.com/ https://www.shopambiance.com/ https://livefreearmory.com/ https://nomadtribetest.com.au/

Web Apps / SaaS:
https://zentrox.us/ https://www.kloudshark.com/ https://real-estate-neon-alpha.vercel.app/ https://fna-estate.vercel.app/ https://www.fanforgecf.com/ https://www.trangapods.com/ https://www.pharma-perspective.com/ https://travel-ten-sandy.vercel.app/ https://school-website-two-psi.vercel.app/ https://courses.cyfi.nestatoys.com/ https://german-consultancy-demo.vercel.app/home https://lawyer-riskometer.vercel.app/ https://lawfirm-sand-six.vercel.app/ https://www.stunn.club/ https://handyman-one-rho.vercel.app/ https://www.thebigbusinessco.com.au/ https://worker-community.vercel.app/ https://moorcuts.framer.website/ https://dribbble.com/Sa_na

3D:
https://pexilz.github.io/3D-generalist/

Figma:
https://www.figma.com/@moses_m https://www.figma.com/design/iYDmJypkAC3i0xXxAI7YII/barons_cars https://www.figma.com/design/5ro3mNfG3MZVTj59UwkmL8/ChowWow https://www.figma.com/file/cVrz58JbHUYiTXXhgSpepk/Lancer---Fashion-Ecommerce-Website

Unity:
https://drive.google.com/drive/folders/1y61BeJzgqvIfhxdPQx9rRc_cn4-KkTbR

PHP / MySQL:
https://www.dolibarr.org/ https://kanboard.org/ https://www.battlemaster.org/

FINAL RULE

Select only 1–3 most relevant links per proposal
Never dump all links
Keep bid sharp, specific, and under 1200 characters

 in this prompt add something

remove subtitles
and if needed add my portfolio(https://onyx.name89maggiotht.workers.dev/ 
) and github(https://github.com/onyx766):

you must make sure the total length less than 1200 characters./

`;
    console.log("Calling Groq with prompt (title only):", title);

    // Call Groq chat completions API with a supported model
    const groqPromise = groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // supported, fast Groq model
      messages: [
        {
          role: "system",
          content:
            "You are an expert freelancer writing proposals for projects on freelancer.com.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    });

    const timeoutMs = 60000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Groq request timed out")), timeoutMs),
    );

    let completion;
    try {
      completion = await Promise.race([groqPromise, timeoutPromise]);
    } catch (e) {
      console.error("Groq call failed or timed out:", e);
      throw e;
    }

    // For Groq chat completions, message.content is a string with the cover letter
    const raw = completion.choices?.[0]?.message?.content;

    let coverLetterText = "";

    if (typeof raw === "string") {
      coverLetterText = raw.trim();
    } else if (raw && typeof raw === "object") {
      // Fallback in case Groq returns structured parts
      if (Array.isArray(raw)) {
        coverLetterText = raw
          .map((part) =>
            typeof part === "string" ? part : part.text || part.content || "",
          )
          .join("")
          .trim();
      } else if (raw.coverLetter) {
        coverLetterText = String(raw.coverLetter).trim();
      }
    }

    if (!coverLetterText) {
      coverLetterText = "Hi, I am glad to work for you.\n\nThanks.";
    }

    const result = {
      coverLetter: coverLetterText,
    };

    // Store in cache for quick reuse
    bidCache[url] = result;

    res.json(result);
  } catch (err) {
    console.error("Error in /generate-bid:", err);
    res.status(500).json({ error: "Failed to generate bid" });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
