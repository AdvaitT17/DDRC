// Government Schemes Data
const schemes = [
    {
        id: 1,
        title: "Education & Training in Government Institutions",
        type: "State Government",
        category: "education",
        objective: "Provide free education, meals, and accommodation to students with disabilities aged 6-18 years in government schools for blind, deaf, and orthopedically disabled children. Vocational training for those above 18 years.",
        eligibleFor: ["Blind", "Deaf", "Orthopedically Disabled"],
        conditions: [
            "Submit application in prescribed format to government institution",
            "Minimum 40% disability certificate required",
            "Must be a resident of Maharashtra"
        ],
        benefits: "Free education and vocational training based on disability type, along with free accommodation and meals.",
        applicationProcess: "Submit prescribed application form with required documents.",
        schemeCategory: "Educational",
        contactOffice: "Related Government Institution & District Social Welfare Officer, Zilla Parishad / Assistant Commissioner, Social Welfare, Mumbai City/Suburbs",
        website: "https://sjsa.maharashtra.gov.in/mr/obc-about-us-mr"
    },
    {
        id: 2,
        title: "Education through NGO-run Special Schools & Workshops",
        type: "State Government",
        category: "education",
        objective: "Provide free education and accommodation to disabled students aged 6-18 through special schools run by NGOs. Vocational training for those above 18 years in workshops.",
        eligibleFor: ["Blind", "Deaf", "Orthopedically Disabled", "Intellectually Disabled"],
        conditions: [
            "Submit application to the concerned school/workshop",
            "Minimum 40% disability certificate required",
            "Must be a resident of Maharashtra"
        ],
        benefits: "Free education and vocational training with accommodation and meals based on disability type.",
        applicationProcess: "Submit prescribed application form with required documents to the institution.",
        schemeCategory: "Educational",
        contactOffice: "NGO Institution & District Social Welfare Officer / Assistant Commissioner, Social Welfare",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 3,
        title: "Disability Welfare State Awards",
        type: "State Government",
        category: "welfare",
        objective: "Recognize and honor outstanding disabled employees, self-employed individuals, and employers who have done excellent work in the disability sector.",
        eligibleFor: ["Blind", "Orthopedically Disabled", "Intellectually Disabled", "Deaf"],
        conditions: [
            "Submit application to Social Welfare Officer in prescribed format",
            "Minimum 40% disability certificate required",
            "Must be a resident of Maharashtra"
        ],
        benefits: "Outstanding Disabled Employee/Self-Employed: ₹10,000 cash, shawl, coconut, citation and certificate (12 awards). Employer of Disabled: ₹25,000 cash, memento, shawl, coconut, citation and certificate (2 awards).",
        applicationProcess: "Submit prescribed application form with required documents.",
        schemeCategory: "Social Reform",
        contactOffice: "District Social Welfare Officer, Zilla Parishad / Assistant Commissioner, Social Welfare",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 4,
        title: "Artificial Limbs & Assistive Devices",
        type: "State Government",
        category: "financial",
        objective: "Provide necessary assistive devices to persons with disabilities based on their individual needs. Devices can be replaced based on age or requirement.",
        eligibleFor: ["Blind", "Partially Blind", "Orthopedically Disabled", "Deaf"],
        conditions: [
            "Submit application in prescribed format",
            "Parent's monthly income should be less than ₹1,500. Those with income ₹1,501-2,000 pay half the cost",
            "Minimum 40% disability certificate required"
        ],
        benefits: "Artificial limbs (calipers, boots, back jackets), tricycles for orthopedically disabled, hearing aids for deaf, spectacles and white canes for blind - devices worth up to ₹3,000.",
        applicationProcess: "Submit prescribed application form with required documents.",
        schemeCategory: "Disability Assistance",
        contactOffice: "District Social Welfare Officer, Zilla Parishad / Assistant Commissioner, Social Welfare",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 5,
        title: "Financial Assistance for Rehabilitation",
        type: "State Government",
        category: "employment",
        objective: "Provide financial assistance to disabled persons who have completed vocational training to start their own business.",
        eligibleFor: ["Blind", "Partially Blind", "Deaf", "Orthopedically Disabled"],
        conditions: [
            "Submit application in prescribed format",
            "Certificate of vocational training from recognized institution",
            "Minimum 40% disability certificate required",
            "Must be a resident of Maharashtra",
            "List of required business equipment with estimated cost"
        ],
        benefits: "Financial assistance of ₹1,000 in the form of equipment/tools for starting a business.",
        applicationProcess: "Submit prescribed application form with required documents.",
        schemeCategory: "Employment Generation",
        contactOffice: "District Social Welfare Officer, Zilla Parishad / Assistant Commissioner, Social Welfare",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 6,
        title: "Seed Capital for Self-Employment",
        type: "State Government",
        category: "employment",
        objective: "Provide merit prizes to top 3 disabled students from each division who pass 10th and 12th standard examinations.",
        eligibleFor: ["Blind", "Deaf", "Spastic/Orthopedically Disabled"],
        conditions: [
            "Must be among top scorers in 10th/12th examinations from divisional education board",
            "Merit list based ranking required"
        ],
        benefits: "Top 3 students from each division receive ₹1,000 cash prize and certificate.",
        applicationProcess: "Submit prescribed application form with required documents.",
        schemeCategory: "Educational",
        contactOffice: "Regional Deputy Commissioner, Social Welfare Department",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 7,
        title: "Merit Prizes for Disabled Students",
        type: "State Government",
        category: "education",
        objective: "Provide merit prizes to top 3 disabled students from each division who pass 10th and 12th standard examinations.",
        eligibleFor: ["Blind", "Deaf", "Spastic/Orthopedically Disabled"],
        conditions: [
            "Must be among top scorers in 10th/12th examinations",
            "Merit list based ranking from divisional examination board"
        ],
        benefits: "Top 3 students from each division receive ₹1,000 cash prize and certificate.",
        applicationProcess: "Submit prescribed application form with required documents.",
        schemeCategory: "Educational",
        contactOffice: "Regional Deputy Commissioner, Social Welfare Department",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 8,
        title: "Group Homes for Intellectually Disabled",
        type: "State Government",
        category: "welfare",
        objective: "Provide care for orphan intellectually disabled children through 19 special group homes run by NGOs (14 funded, 5 unfunded).",
        eligibleFor: ["Intellectually Disabled"],
        conditions: [
            "Submit application to Child Welfare Committee in prescribed format",
            "Minimum 40% disability and orphan status required",
            "Must be a resident of Maharashtra"
        ],
        benefits: "Educational, health, and maintenance facilities with grants for care and upkeep as per special school norms.",
        applicationProcess: "Submit prescribed application form with documents to Child Welfare Committee.",
        schemeCategory: "Educational",
        contactOffice: "Child Welfare Committee of the concerned district",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 9,
        title: "Homes for Elderly & Disabled (Zilla Parishad)",
        type: "State Government",
        category: "welfare",
        objective: "Provide food, accommodation, shelter and other facilities to elderly and disabled persons through funded NGOs.",
        eligibleFor: ["All categories of elderly and disabled"],
        conditions: [
            "Must be a resident of Maharashtra",
            "Men: 60+ years, Women: 55+ years",
            "Must be destitute/homeless"
        ],
        benefits: "Monthly maintenance grant of ₹900 per resident for food, accommodation, and medical care.",
        applicationProcess: "Apply to the concerned old age home, funded institution, or District Social Welfare Officer.",
        schemeCategory: "Special Assistance",
        contactOffice: "District Social Welfare Officer, Zilla Parishad / Assistant Commissioner, Social Welfare",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 10,
        title: "Marriage Incentive for Disabled-Non-Disabled Couples",
        type: "State Government",
        category: "welfare",
        objective: "Encourage marriages between disabled and non-disabled persons by providing financial incentive.",
        eligibleFor: ["All categories of disabled persons"],
        conditions: [
            "One spouse must be disabled and other non-disabled",
            "Must be a resident of Maharashtra"
        ],
        benefits: "Financial incentive for inter-abled marriages.",
        applicationProcess: "Apply to District Social Welfare Officer with marriage certificate and disability certificate.",
        schemeCategory: "Social Welfare",
        contactOffice: "District Social Welfare Officer, Zilla Parishad / Assistant Commissioner, Social Welfare",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 11,
        title: "Post-Matric Scholarships for Disabled Students",
        type: "State Government",
        category: "education",
        objective: "Encourage disabled students to pursue higher education after 10th standard.",
        eligibleFor: ["Blind", "Partially Blind", "Deaf", "Orthopedically Disabled", "Intellectually Disabled", "Mental Illness", "Leprosy Cured"],
        conditions: [
            "Student in any course after 10th (graduate, post-graduate, diploma, technical, vocational)",
            "Should not have failed in previous year",
            "Minimum 40% disability certificate from medical board",
            "No income limit"
        ],
        benefits: "Scholarship for all eligible disabled students pursuing higher education.",
        applicationProcess: "Submit prescribed application form with required documents.",
        schemeCategory: "Educational",
        contactOffice: "District Social Welfare Officer, Zilla Parishad / Assistant Commissioner, Social Welfare",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 12,
        title: "Pre-Matric Scholarships for Disabled Students",
        type: "State Government",
        category: "education",
        objective: "Encourage disabled students in classes 1st to 10th to continue their education.",
        eligibleFor: ["Blind", "Partially Blind", "Deaf", "Orthopedically Disabled", "Intellectually Disabled", "Mental Illness", "Leprosy Cured"],
        conditions: [
            "Student in any class from 1st to 10th",
            "Should not have failed more than once in same class",
            "Minimum 40% disability certificate from medical board",
            "No income limit"
        ],
        benefits: "Monthly scholarship for eligible disabled students.",
        applicationProcess: "Submit prescribed application form with required documents.",
        schemeCategory: "Educational",
        contactOffice: "District Social Welfare Officer, Zilla Parishad / Assistant Commissioner, Social Welfare",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 13,
        title: "Indira Gandhi National Disability Pension",
        type: "State Government",
        category: "financial",
        objective: "Provide monthly pension to disabled persons in the state.",
        eligibleFor: ["All categories of disabled persons"],
        conditions: [
            "Must be in BPL (Below Poverty Line) list",
            "Age 18-65 years with 80%+ disability OR multiple disabilities",
            "Must be a resident of Maharashtra"
        ],
        benefits: "Monthly pension of ₹600 (₹200 from Central Govt + ₹400 from State Govt under Sanjay Gandhi Niradhar scheme).",
        applicationProcess: "Apply at District Collector Office / Tahsildar (Sanjay Gandhi Scheme) / Talathi Office.",
        schemeCategory: "Pension",
        contactOffice: "District Collector Office / Tahsildar (Sanjay Gandhi Scheme) / Talathi Office",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    },
    {
        id: 14,
        title: "Loan Schemes (Term Loan, Educational Loan, Micro Finance)",
        type: "State Government",
        category: "financial",
        objective: "Provide financial assistance for self-employment to disabled persons through the Maharashtra State Disabled Finance and Development Corporation.",
        eligibleFor: ["All categories of disabled persons"],
        conditions: [
            "Minimum 40% disability required",
            "Age 18 years or above",
            "Should have knowledge or experience in chosen business"
        ],
        benefits: "Low-interest loans for self-employment, education, and economic advancement. Includes Term Loans, Educational Loans, Micro Finance, and Direct Loans.",
        applicationProcess: "Apply through district offices of Maharashtra State OBC Finance and Development Corporation. Online applications available.",
        schemeCategory: "Financial Assistance",
        contactOffice: "Maharashtra State Disabled Finance & Development Corporation, Bandra, Mumbai-51. Phone: 022-26591620/22, Fax: 022-26591621",
        website: "https://sjsa.maharashtra.gov.in/mr/scheme-category/disability-welfare"
    }
];

// Render schemes
function renderSchemes(filter = 'all') {
    const container = document.getElementById('schemesList');
    const filtered = filter === 'all' ? schemes : schemes.filter(s => s.category === filter);

    container.innerHTML = filtered.map(scheme => `
        <div class="scheme-card-full" data-category="${scheme.category}">
            <div class="scheme-header" onclick="toggleScheme(this)">
                <div>
                    <h3>${scheme.title}</h3>
                    <span class="scheme-type">${scheme.type}</span>
                </div>
                <button class="scheme-toggle" aria-label="Toggle details">▼</button>
            </div>
            <div class="scheme-body">
                <div class="scheme-content">
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Objective</h4>
                        <p>${scheme.objective}</p>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> Eligible Categories</h4>
                        <div class="scheme-tags">
                            ${scheme.eligibleFor.map(e => `<span class="scheme-tag">${e}</span>`).join('')}
                        </div>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> Eligibility Conditions</h4>
                        <ul>${scheme.conditions.map(c => `<li>${c}</li>`).join('')}</ul>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> Benefits</h4>
                        <p>${scheme.benefits}</p>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Application Process</h4>
                        <p>${scheme.applicationProcess}</p>
                    </div>
                    <div class="scheme-section">
                        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> Contact Office</h4>
                        <p>${scheme.contactOffice}</p>
                    </div>
                    <div class="scheme-links">
                        <a href="${scheme.website}" target="_blank" class="scheme-link">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                            Official Website
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Toggle scheme accordion
function toggleScheme(header) {
    const card = header.closest('.scheme-card-full');
    card.classList.toggle('active');
}

// Category filter
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSchemes(btn.dataset.category);
    });
});

// Initial render
document.addEventListener('DOMContentLoaded', () => renderSchemes());
