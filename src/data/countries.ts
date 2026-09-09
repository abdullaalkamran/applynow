export interface CountryOption {
  name: string;
  iso2: string;
  dial: string;
  flag: string;
  cities: string[];
}

export const COUNTRIES: CountryOption[] = [
  { name: "Bangladesh", iso2: "BD", dial: "+880", flag: "🇧🇩", cities: [
    "Dhaka", "Chittagong", "Khulna", "Rajshahi", "Sylhet", "Barisal", "Rangpur", "Mymensingh",
    "Comilla", "Narayanganj", "Gazipur", "Jessore", "Bogra", "Dinajpur", "Cox's Bazar", "Tangail",
    "Feni", "Brahmanbaria", "Noakhali", "Pabna",
  ] },
  { name: "India", iso2: "IN", dial: "+91", flag: "🇮🇳", cities: [
    "Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata", "Hyderabad", "Pune", "Ahmedabad",
    "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal",
    "Visakhapatnam", "Patna", "Vadodara", "Chandigarh",
  ] },
  { name: "Pakistan", iso2: "PK", dial: "+92", flag: "🇵🇰", cities: [
    "Karachi", "Lahore", "Islamabad", "Faisalabad", "Rawalpindi", "Multan", "Peshawar",
    "Quetta", "Sialkot", "Gujranwala",
  ] },
  { name: "Nepal", iso2: "NP", dial: "+977", flag: "🇳🇵", cities: [
    "Kathmandu", "Pokhara", "Lalitpur", "Bharatpur", "Biratnagar", "Birgunj",
  ] },
  { name: "Sri Lanka", iso2: "LK", dial: "+94", flag: "🇱🇰", cities: [
    "Colombo", "Kandy", "Galle", "Jaffna", "Negombo", "Trincomalee",
  ] },
  { name: "Nigeria", iso2: "NG", dial: "+234", flag: "🇳🇬", cities: [
    "Lagos", "Abuja", "Ibadan", "Kano", "Port Harcourt", "Benin City", "Kaduna", "Enugu",
  ] },
  { name: "Ghana", iso2: "GH", dial: "+233", flag: "🇬🇭", cities: [
    "Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast",
  ] },
  { name: "Kenya", iso2: "KE", dial: "+254", flag: "🇰🇪", cities: [
    "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret",
  ] },
  { name: "Egypt", iso2: "EG", dial: "+20", flag: "🇪🇬", cities: [
    "Cairo", "Alexandria", "Giza", "Shubra El Kheima", "Port Said", "Suez", "Luxor",
  ] },
  { name: "Vietnam", iso2: "VN", dial: "+84", flag: "🇻🇳", cities: [
    "Hanoi", "Ho Chi Minh City", "Da Nang", "Hai Phong", "Can Tho",
  ] },
  { name: "China", iso2: "CN", dial: "+86", flag: "🇨🇳", cities: [
    "Beijing", "Shanghai", "Shenzhen", "Guangzhou", "Chengdu", "Hangzhou", "Wuhan",
    "Xi'an", "Nanjing", "Chongqing",
  ] },
  { name: "United Kingdom", iso2: "GB", dial: "+44", flag: "🇬🇧", cities: [
    "London", "Manchester", "Birmingham", "Edinburgh", "Leeds", "Glasgow", "Liverpool",
    "Bristol", "Sheffield", "Newcastle", "Nottingham", "Cardiff", "Belfast", "Coventry", "Southampton",
  ] },
  { name: "United States", iso2: "US", dial: "+1", flag: "🇺🇸", cities: [
    "New York", "Los Angeles", "Chicago", "Boston", "Houston", "Philadelphia", "Phoenix",
    "San Antonio", "San Diego", "Dallas", "San Francisco", "Seattle", "Austin", "Miami", "Atlanta",
  ] },
  { name: "Canada", iso2: "CA", dial: "+1", flag: "🇨🇦", cities: [
    "Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Winnipeg",
    "Quebec City", "Hamilton",
  ] },
  { name: "Australia", iso2: "AU", dial: "+61", flag: "🇦🇺", cities: [
    "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra",
    "Newcastle", "Hobart",
  ] },
  { name: "Ireland", iso2: "IE", dial: "+353", flag: "🇮🇪", cities: [
    "Dublin", "Cork", "Galway", "Limerick", "Waterford",
  ] },
  { name: "Germany", iso2: "DE", dial: "+49", flag: "🇩🇪", cities: [
    "Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Düsseldorf", "Leipzig",
  ] },
  { name: "United Arab Emirates", iso2: "AE", dial: "+971", flag: "🇦🇪", cities: [
    "Dubai", "Abu Dhabi", "Sharjah", "Al Ain", "Ajman", "Ras Al Khaimah",
  ] },
];

export function countryByName(name: string): CountryOption | undefined {
  return COUNTRIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export function countryByIso2(iso2: string): CountryOption | undefined {
  return COUNTRIES.find((c) => c.iso2 === iso2);
}
