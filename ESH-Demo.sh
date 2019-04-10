# Evidence Synthesis Hackathon 2019 - Demo

# Step 1 - Use I3 to fetch some results from Epistemonikos about 'antidepresents'
i3 --action=apps/epistemonikos -s query=antidepresents -s authToken=`cat ~/.epistemonikos.token` --output=search-results.json

# Output the results we fetched
cat search-results.json | jq .



# Step 2 - Pipe these search results though Iain Marshalls RCT predictor - Robot Search
i3 --action=apps/RCT_Predictor --input=search-results.json --output=rcts.json

# Output the results
cat rcts.json | jq .



# Step 3 - Identify keywords in each citations abstract - via dperezradas algorithm
i3 --action=apps/Keyword_Identification --input=rcts.json --output=keyworded.json

# Output the results
cat keyworded.tidy.json | jq -S .



# Non-Working implementations beyond this point - Here be dragons!

# NON-WORKING - Extract synonyms from keywords
i3 --action=apps/keyword_synonyms --input=keyworded.json --output=expanded-keywords.csv

# NON-WORKING - Filter by recent citations
i3 --action=apps/filter-by-year --input=refs.csv --output=recent.json -s yearFrom=2010

# NON-WORKING - Upload to Google Drive
i3 --action=apps/google-drive --input=refs.csv -s filename=MyData.json
