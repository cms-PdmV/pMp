curl -X DELETE -s localhost:9200/workflows
curl -X DELETE -s localhost:9200/rereco_requests
curl -X DELETE -s localhost:9200/requests
curl -X DELETE -s localhost:9200/chained_requests
curl -X DELETE -s localhost:9200/campaigns
curl -X DELETE -s localhost:9200/chained_campaigns
curl -X DELETE -s localhost:9200/flows

curl -X DELETE -s localhost:9200/last_sequences

curl -X PUT localhost:9200/last_sequences/last_seq/requests -d '{"val":"450000"}' -H "Content-Type: application/json"
curl -X PUT localhost:9200/last_sequences/last_seq/workflows -d '{"val":"192000-g1AAAAJ7eJyd0ksKwjAQANBgBd32BCq4lqb_ruxB1JpJUkqpduVab6I3UVy49wSKF6lpUrsqQsrADCTMY8ikQAiNM4Mhk5YHmjGIsR0sLBG4EFcDgmBSVVWeGYDQZrYTZyOL-pTavKvnjwRTkWHZYslcYjSNMAZtLK6xpMXWpsR8OySOh3WxbY0dW2z1UZNZIRAeaGL7ocjoJIrwzg34VO_GmJvytBd4UeC1Ae8ShIgTJ3B6gTcFvprNPiRoc-xzrLsMBb4V-PsqpQRdDzwfR12t-RcAA6aR"}' -H "Content-Type: application/json"
curl -X PUT localhost:9200/last_sequences/last_seq/chained_requests -d '{"val":"160000"}' -H "Content-Type: application/json"