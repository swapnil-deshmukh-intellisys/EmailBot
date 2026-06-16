const mongoose = require('mongoose');
require('dotenv').config();

const LeadSchema = new mongoose.Schema({ Email: String }, { _id: false });
const LeadListSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    userEmail: String,
    name: String,
    sourceFile: String,
    kind: String,
    deletedAt: Date,
    project: String,
    projectId: String,
    projectName: String,
    leads: [LeadSchema]
  },
  { timestamps: true }
);

const LeadList = mongoose.models.LeadList || mongoose.model('LeadList', LeadListSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const lists = await LeadList.find({ userEmail: 'akshaymore.intellisys@gmail.com', deletedAt: null }).lean();
  for (const list of lists) {
    console.log(`- ID: ${list._id}, Name: "${list.name}", Kind: "${list.kind}", Project: "${list.project}", ProjectId: "${list.projectId}", ProjectName: "${list.projectName}", Leads: ${list.leads?.length}`);
  }
  await mongoose.disconnect();
}

run().catch(console.error);
