namespace data;

entity Products {
  ID        : UUID @key;
  sku       : String(60) @unique;
  name      : String(200);
  price     : Decimal(15,2);
  currency  : String(3) default 'TRY';
  stock     : Integer default 0;
  category  : String(80);
  brand     : String(80);
  color     : String(40);
  barcode   : String(32);
  weight    : Decimal(10,3); 
  unit      : String(10) default 'adet';
  description: String(1000);
  createdAt : Timestamp default current_timestamp;
  updatedAt : Timestamp;
}

entity Embeddings {
  ID         : UUID @key;
  product    : Association to Products;
  chunkIndex : Integer;          
  text       : String(5000);    
  embedding  : LargeString;       
  model      : String(100);      
  dim        : Integer;       
  createdAt  : Timestamp default current_timestamp;
}

entity ProductVectors {
  sku       : String(60) @key;
  embedding : LargeString;
}
