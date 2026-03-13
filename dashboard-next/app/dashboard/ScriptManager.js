"use client";
import { useState } from "react";

export default function ScriptManager() {

const [showModal,setShowModal] = useState(false);

const [category,setCategory] = useState("cover_story");
const [subject,setSubject] = useState("");
const [body,setBody] = useState("");

const [scripts,setScripts] = useState([]);

const addScript = () => {

if(!subject || !body){
alert("Enter subject and body");
return;
}

const count = scripts.filter(s=>s.category===category).length+1;

const newScript = {
id:Date.now(),
title:`${category} Script ${count}`,
category,
subject,
body
};

setScripts([...scripts,newScript]);

setShowModal(false);
setSubject("");
setBody("");

};

const loadScript = (script)=>{
alert("Loaded script:\n"+script.subject);
};

return(

<div style={{padding:"30px"}}>

<h2>Email Bot Dashboard</h2>

<button
onClick={()=>setShowModal(true)}
style={{
background:"#2563eb",
color:"#fff",
padding:"10px 18px",
border:"none",
borderRadius:"6px",
cursor:"pointer",
marginBottom:"20px"
}}
>
+ Add Draft Script
</button>

{/* Script Cards */}

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(4,1fr)",
gap:"20px"
}}
>

{scripts.map((script)=>(
<div
key={script.id}
onClick={()=>loadScript(script)}
style={{
border:"1px solid #ddd",
padding:"15px",
borderRadius:"8px",
cursor:"pointer",
boxShadow:"0 2px 5px rgba(0,0,0,0.1)"
}}
>

<h4>{script.title}</h4>
<p style={{fontSize:"12px",color:"#666"}}>Click to load</p>

</div>
))}

</div>

{/* Modal */}

{showModal && (

<div
style={{
position:"fixed",
top:0,
left:0,
right:0,
bottom:0,
background:"rgba(0,0,0,0.4)",
display:"flex",
alignItems:"center",
justifyContent:"center"
}}
>

<div
style={{
background:"#fff",
padding:"25px",
borderRadius:"10px",
width:"400px"
}}
>

<h3>Add Draft Script</h3>

<select
value={category}
onChange={(e)=>setCategory(e.target.value)}
style={{width:"100%",marginBottom:"10px"}}
>

<option value="cover_story">Cover Story</option>
<option value="reminder">Reminder</option>
<option value="follow_up">Follow Up</option>
<option value="updated_cost">Updated Cost</option>
<option value="final_cost">Final Cost</option>

</select>

<input
placeholder="Subject Line"
value={subject}
onChange={(e)=>setSubject(e.target.value)}
style={{width:"100%",marginBottom:"10px",padding:"8px"}}
/>

<textarea
placeholder="Draft Body"
value={body}
onChange={(e)=>setBody(e.target.value)}
style={{width:"100%",height:"120px",padding:"8px"}}
/>

<div style={{marginTop:"10px"}}>

<button
onClick={addScript}
style={{
background:"#2563eb",
color:"#fff",
padding:"8px 14px",
border:"none",
borderRadius:"6px",
marginRight:"10px"
}}
>
Submit Draft
</button>

<button
onClick={()=>setShowModal(false)}
style={{
padding:"8px 14px"
}}
>
Cancel
</button>

</div>

</div>

</div>

)}

</div>

);

}